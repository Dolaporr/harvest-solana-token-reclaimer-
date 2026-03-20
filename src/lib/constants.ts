// ─────────────────────────────────────────────────────────────────────────────
// src/lib/constants.ts
// Central place for all Solana-related constants.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helius is our recommended RPC provider. It supports:
 *  - Standard JSON-RPC (getParsedTokenAccountsByOwner, simulateTransaction, etc.)
 *  - DAS API (getAssetBatch) for token metadata / logos
 *  - Priority fee estimator
 *
 * Falls back to the public mainnet endpoint if no env var is set.
 * WARNING: The public endpoint is heavily rate-limited — always use Helius in prod.
 */
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;
const HELIUS_RPC_URL = import.meta.env.VITE_HELIUS_RPC_URL;
const RPC_PROVIDER = (import.meta.env.VITE_RPC_PROVIDER || "helius").toLowerCase();

const HELIUS_URL =
  HELIUS_RPC_URL ||
  (HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : undefined);

const PROVIDERS: Record<string, string | undefined> = {
  helius: HELIUS_URL,
  triton: import.meta.env.VITE_TRITON_RPC_URL,
  quicknode: import.meta.env.VITE_QUICKNODE_RPC_URL,
};

const FALLBACK_URL = HELIUS_URL || "https://api.mainnet-beta.solana.com";

export const RPC_URL = PROVIDERS[RPC_PROVIDER] || FALLBACK_URL;
export const RPC_LABEL = PROVIDERS[RPC_PROVIDER] ? RPC_PROVIDER : "helius";
export const RPC_WS_URL =
  RPC_PROVIDER === "triton"
    ? import.meta.env.VITE_TRITON_WS_URL
    : RPC_PROVIDER === "quicknode"
    ? import.meta.env.VITE_QUICKNODE_WS_URL
    : undefined;

/**
 * Standard SPL Token Account rent-exemption amount.
 * All accounts created by the token program require exactly this amount.
 * Verified via: `solana rent 165` (token account data size = 165 bytes)
 */
export const RENT_PER_ACCOUNT_SOL = 0.00203928;
export const RENT_PER_ACCOUNT_LAMPORTS = 2_039_280;

/**
 * Max instructions per transaction to stay well under the 1232-byte packet limit.
 * Each closeAccount instruction is ~67 bytes. With the ComputeBudget header (~50 bytes)
 * and blockhash/fee-payer overhead, 20 accounts is a safe ceiling.
 */
export const CLOSE_ACCOUNTS_BATCH_SIZE = 20;

/**
 * Priority fee added to every transaction to ensure it lands during congestion.
 * 50,000 microLamports = 0.00000005 SOL per compute unit — roughly top 10% median.
 * Helius's priority fee API can be used to make this dynamic; 50k is a safe default.
 */
export const PRIORITY_FEE_MICROLAMPORTS = 50_000;

/** RPC commitment level used across the app. "confirmed" is the sweet spot:
 *  faster than "finalized" but safer than "processed". */
export const COMMITMENT = "confirmed" as const;

/** Explorer URL prefix for displaying transaction links */
export const EXPLORER_BASE = "https://solscan.io/tx";
