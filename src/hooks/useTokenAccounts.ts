// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useTokenAccounts.ts
//
// React hook that encapsulates the full token account scanning flow:
//   1. Connects to the user's wallet via @solana/wallet-adapter-react
//   2. Fires parallel RPC calls to both Token and Token-2022 programs
//   3. Enriches results with human-readable names via Helius DAS
//   4. Exposes toggle/select helpers for the Dashboard UI
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  scanEmptyTokenAccounts,
  fetchTokenMetadataBatch,
  shortenAddress,
  lamportsToSol,
  type EmptyTokenAccount,
} from "@/lib/solana";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A scanned account enriched with UI-friendly display fields */
export interface DisplayAccount extends EmptyTokenAccount {
  /** Stable unique key for React lists (base58 pubkey) */
  id: string;
  /** Human-readable token name (from Helius DAS, falls back to mint address) */
  displayName: string;
  /** Token symbol or "—" */
  symbol: string;
  /** Token logo URL if available */
  logo?: string;
  /** Whether the user has selected this account for closing */
  selected: boolean;
  /** Rent in SOL (convenience, derived from rentLamports) */
  rentSol: number;
  /** Display-friendly mint address e.g. "DezX…9kfP" */
  mintShort: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTokenAccounts() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [accounts, setAccounts] = useState<DisplayAccount[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // ── Main scan function ────────────────────────────────────────────────────

  const scan = useCallback(async () => {
    if (!publicKey || !connected) return;

    setScanning(true);
    setError(null);
    setAccounts([]);

    try {
      // Step 1: Fetch all zero-balance accounts from both token programs
      const raw: EmptyTokenAccount[] = await scanEmptyTokenAccounts(
        connection,
        publicKey
      );

      if (raw.length === 0) {
        setAccounts([]);
        setHasScanned(true);
        return;
      }

      // Step 2: Batch-fetch token metadata (names, symbols, logos) from Helius DAS.
      // This runs concurrently with UI rendering — accounts appear instantly
      // and metadata fills in progressively.
      const mints = [...new Set(raw.map((a) => a.mint))];
      const metadata = await fetchTokenMetadataBatch(mints);

      // Step 3: Merge raw account data with metadata into DisplayAccount objects
      const display: DisplayAccount[] = raw.map((account) => {
        const meta = metadata.get(account.mint);
        return {
          ...account,
          id: account.pubkey.toBase58(),
          displayName: meta?.name || shortenAddress(account.mint),
          symbol: meta?.symbol || "—",
          logo: meta?.logo,
          selected: true, // All accounts are pre-selected for convenience
          rentSol: lamportsToSol(account.rentLamports),
          mintShort: shortenAddress(account.mint),
        };
      });

      // Sort: largest rent first so high-value accounts are visible at the top
      display.sort((a, b) => b.rentLamports - a.rentLamports);

      setAccounts(display);
      setHasScanned(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error during scan";
      setError(message);
    } finally {
      setScanning(false);
    }
  }, [connection, publicKey, connected]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleAccount = useCallback((id: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  }, []);

  const toggleAll = useCallback(() => {
    setAccounts((prev) => {
      const allSelected = prev.every((a) => a.selected);
      return prev.map((a) => ({ ...a, selected: !allSelected }));
    });
  }, []);

  /** Remove successfully closed accounts from the local list */
  const removeAccounts = useCallback((ids: Set<string>) => {
    setAccounts((prev) => prev.filter((a) => !ids.has(a.id)));
  }, []);

  /** Reset to the initial idle state */
  const reset = useCallback(() => {
    setAccounts([]);
    setHasScanned(false);
    setError(null);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const selected = accounts.filter((a) => a.selected);
  const totalReclaimableSol = selected.reduce((sum, a) => sum + a.rentSol, 0);
  const allSelected = accounts.length > 0 && accounts.every((a) => a.selected);

  return {
    // State
    accounts,
    scanning,
    error,
    hasScanned,
    // Actions
    scan,
    toggleAccount,
    toggleAll,
    removeAccounts,
    reset,
    // Derived
    selected,
    totalReclaimableSol,
    allSelected,
  };
}
