// ─────────────────────────────────────────────────────────────────────────────
// src/lib/solana.ts
//
// All core Solana logic for the Rent Reclaimer dApp:
//   1. scanEmptyTokenAccounts  — fetches zero-balance accounts from both token programs
//   2. fetchTokenMetadataBatch — resolves human-readable names/logos via Helius DAS
//   3. buildCloseAccountTxs    — creates batched, priority-fee-enhanced transactions
//   4. simulateTransaction     — pre-flight check before asking the user to sign
// ─────────────────────────────────────────────────────────────────────────────

import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import {
  CLOSE_ACCOUNTS_BATCH_SIZE,
  PRIORITY_FEE_MICROLAMPORTS,
  RPC_URL,
} from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmptyTokenAccount {
  /** The token account public key (what we are closing) */
  pubkey: PublicKey;
  /** The mint this account holds */
  mint: string;
  /** Which SPL Token program owns this account */
  program: "token" | "token-2022";
  /** Actual on-chain lamports that will be returned to the owner */
  rentLamports: number;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  logo?: string;
}

// ─── 1. Scanning ─────────────────────────────────────────────────────────────

/**
 * Fetches ALL token accounts for `owner` across BOTH the legacy Token Program
 * and the newer Token-2022 Program, then filters to only those with a zero
 * token balance — i.e., accounts that are safe to close.
 *
 * Why two programs?
 *   TOKEN_PROGRAM_ID      → TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
 *   TOKEN_2022_PROGRAM_ID → TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
 * Many newer tokens (cNFTs, compressed assets, newer DeFi protocols) use Token-2022.
 */
export async function scanEmptyTokenAccounts(
  connection: Connection,
  owner: PublicKey
): Promise<EmptyTokenAccount[]> {
  const programs: Array<{ id: PublicKey; label: EmptyTokenAccount["program"] }> =
    [
      { id: TOKEN_PROGRAM_ID, label: "token" },
      { id: TOKEN_2022_PROGRAM_ID, label: "token-2022" },
    ];

  // Fire both RPC calls in parallel
  const results = await Promise.all(
    programs.map(async ({ id, label }) => {
      const { value: accounts } =
        await connection.getParsedTokenAccountsByOwner(owner, {
          programId: id,
        });

      const empty: EmptyTokenAccount[] = [];

      for (const { pubkey, account } of accounts) {
        const parsed = account.data?.parsed?.info;
        if (!parsed) continue;

        // Filter: only accounts with exactly 0 tokens.
        // We read `amount` (raw u64 string) rather than `uiAmount` to avoid
        // floating-point edge cases (e.g. tokens with 0 decimals).
        const rawAmount: string = parsed.tokenAmount?.amount ?? "1";
        if (rawAmount !== "0") continue;

        empty.push({
          pubkey,
          mint: parsed.mint as string,
          program: label,
          rentLamports: account.lamports,
        });
      }

      return empty;
    })
  );

  return results.flat();
}

// ─── 2. Token Metadata (Helius DAS API) ─────────────────────────────────────

/**
 * Batch-fetches human-readable token names, symbols, and logos via the Helius
 * DAS `getAssetBatch` method. This is a Helius-specific extension to the
 * standard Solana JSON-RPC API.
 *
 * Falls back gracefully — if the RPC is not Helius (or the call fails for any
 * reason), callers simply won't get enriched metadata, but the app keeps working.
 *
 * @param mints - Array of mint addresses to resolve
 * @returns Map<mintAddress, TokenMetadata>
 */
export async function fetchTokenMetadataBatch(
  mints: string[]
): Promise<Map<string, TokenMetadata>> {
  const metaMap = new Map<string, TokenMetadata>();
  if (!mints.length) return metaMap;

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "harvest-get-assets",
        method: "getAssetBatch",
        params: { ids: mints },
      }),
    });

    if (!response.ok) return metaMap; // Non-Helius RPC — silently skip

    const { result } = (await response.json()) as {
      result?: Array<{
        id: string;
        content?: {
          metadata?: { name?: string; symbol?: string };
          links?: { image?: string };
        };
      } | null>;
    };

    for (const asset of result ?? []) {
      if (!asset) continue;
      const name = asset.content?.metadata?.name?.trim() || "";
      const symbol = asset.content?.metadata?.symbol?.trim() || "";
      if (name || symbol) {
        metaMap.set(asset.id, {
          name: name || symbol || shortenAddress(asset.id),
          symbol: symbol || "—",
          logo: asset.content?.links?.image,
        });
      }
    }
  } catch {
    // Network error or non-Helius node — callers fall back to mint address
  }

  return metaMap;
}

// ─── 3. Transaction Builder ───────────────────────────────────────────────────

/**
 * Builds one or more Transaction objects that close the provided token accounts.
 *
 * Design decisions:
 *   • Chunked into CLOSE_ACCOUNTS_BATCH_SIZE (20) accounts per transaction.
 *     This keeps each transaction comfortably under Solana's 1232-byte MTU.
 *   • Each transaction gets a ComputeBudgetProgram.setComputeUnitPrice instruction
 *     prepended so it's prioritised during congestion.
 *   • The `destination` for reclaimed rent is always the owner's wallet — never
 *     a third-party address.
 *   • Each instruction uses the CORRECT program ID for the account being closed.
 *     Mixing Token-2022 accounts with the legacy TOKEN_PROGRAM_ID would cause
 *     "incorrect program id" errors on-chain.
 *
 * @param accounts       - The empty accounts to close
 * @param owner          - The wallet that owns all accounts (authority + destination)
 * @param recentBlockhash - Fresh blockhash obtained just before calling this function
 */
export function buildCloseAccountTxs(
  accounts: EmptyTokenAccount[],
  owner: PublicKey,
  recentBlockhash: string
): Transaction[] {
  // Split into chunks
  const chunks: EmptyTokenAccount[][] = [];
  for (let i = 0; i < accounts.length; i += CLOSE_ACCOUNTS_BATCH_SIZE) {
    chunks.push(accounts.slice(i, i + CLOSE_ACCOUNTS_BATCH_SIZE));
  }

  return chunks.map((chunk) => {
    const tx = new Transaction();

    // ── Priority Fee ─────────────────────────────────────────────────────────
    // This ensures the transaction is included in the next block even when the
    // network is busy. setComputeUnitPrice must come BEFORE other instructions.
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICROLAMPORTS,
      })
    );

    // ── Close Account Instructions ────────────────────────────────────────────
    for (const account of chunk) {
      const programId =
        account.program === "token-2022"
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

      tx.add(
        createCloseAccountInstruction(
          account.pubkey, // account   — the token account to close
          owner,          // dest      — receives the reclaimed rent lamports
          owner,          // authority — must be the token account's owner
          [],             // multiSigners — none (single-sig wallet)
          programId       // programId — MUST match the account's owning program
        )
      );
    }

    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = owner;

    return tx;
  });
}

// ─── 4. Pre-flight Simulation ────────────────────────────────────────────────

/**
 * Simulates a transaction against the current chain state to catch errors
 * BEFORE asking the user to sign. This is the safety net that prevents wasted
 * signatures and confusing failed-transaction UX.
 *
 * Throws a human-readable error if the simulation indicates failure.
 */
export async function simulateTx(
  connection: Connection,
  tx: Transaction
): Promise<void> {
  const { value: simResult } = await connection.simulateTransaction(tx);

  if (simResult.err) {
    const logs = simResult.logs?.join("\n") ?? "";
    // Pull out the most informative error log line for display
    const errorLine =
      simResult.logs?.find((l) => l.includes("Error") || l.includes("failed")) ??
      JSON.stringify(simResult.err);
    throw new Error(`Simulation failed: ${errorLine}\n\nLogs:\n${logs}`);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}
