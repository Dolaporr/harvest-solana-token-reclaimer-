// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useReclaimAccounts.ts
//
// Orchestrates the full "close accounts" transaction pipeline:
//   1. Fetches a fresh blockhash
//   2. Builds batched transactions (with priority fees)
//   3. Pre-flight simulates EVERY transaction before asking for a signature
//   4. Requests wallet signatures via signAllTransactions (single wallet popup)
//   5. Sends raw transactions to the network
//   6. Confirms all transactions concurrently
//   7. Fires Sonner toasts at each stage for real-time feedback
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { buildCloseAccountTxs, simulateTx } from "@/lib/solana";
import {
  CLOSE_ACCOUNTS_BATCH_SIZE,
  EXPLORER_BASE,
  RPC_LABEL,
} from "@/lib/constants";
import type { DisplayAccount } from "./useTokenAccounts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReclaimResult {
  signatures: string[];
  closedCount: number;
  reclaimedSol: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useReclaimAccounts() {
  const { connection } = useConnection();
  const { publicKey, signAllTransactions } = useWallet();
  const runIdRef = useRef(0);

  const [reclaiming, setReclaiming] = useState(false);
  const [result, setResult] = useState<ReclaimResult | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<
    "idle" | "running" | "passed" | "failed"
  >("idle");
  const clearResult = useCallback(() => setResult(null), []);
  const resetSimulation = useCallback(() => setSimulationStatus("idle"), []);

  const reclaim = useCallback(
    async (selectedAccounts: DisplayAccount[]): Promise<ReclaimResult> => {
      // ── Guards ──────────────────────────────────────────────────────────────
      if (!publicKey) throw new Error("Wallet not connected");
      if (!signAllTransactions)
        throw new Error(
          "Your wallet does not support signAllTransactions. Please use Phantom or Solflare."
        );
      if (selectedAccounts.length === 0)
        throw new Error("No accounts selected");

      setReclaiming(true);
      setResult(null);

      const batchCount = Math.ceil(
        selectedAccounts.length / CLOSE_ACCOUNTS_BATCH_SIZE
      );

      const runId = ++runIdRef.current;
      const labelPrefix = `[${RPC_LABEL} #${runId}]`;
      const overallLabel = `${labelPrefix} reclaim`;
      console.time(overallLabel);

      const toastId = toast.loading(
        `Preparing ${selectedAccounts.length} account${selectedAccounts.length > 1 ? "s" : ""} across ${batchCount} transaction${batchCount > 1 ? "s" : ""}…`
      );

      try {
        // ── Step 1: Fresh blockhash ─────────────────────────────────────────
        // Getting the blockhash right before building transactions minimises
        // the risk of it expiring before confirmation.
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");

        // ── Step 2: Build all transactions ──────────────────────────────────
        const transactions = buildCloseAccountTxs(
          selectedAccounts,
          publicKey,
          blockhash
        );

        // ── Step 3: Pre-flight simulation ───────────────────────────────────
        // Simulate EVERY transaction before requesting wallet signatures.
        // This catches common errors (already-closed accounts, wrong authority,
        // etc.) and avoids wasting the user's confirmation UX.
        toast.loading(
          `Simulating ${transactions.length} transaction${transactions.length > 1 ? "s" : ""}…`,
          { id: toastId }
        );

        setSimulationStatus("running");
        const simLabel = `${labelPrefix} simulate`;
        console.time(simLabel);
        try {
          await Promise.all(
            transactions.map((tx) => simulateTx(connection, tx))
          );
          setSimulationStatus("passed");
        } catch (err) {
          setSimulationStatus("failed");
          throw err;
        } finally {
          console.timeEnd(simLabel);
        }

        // ── Step 4: Request wallet signatures ───────────────────────────────
        // signAllTransactions batches all transactions into a SINGLE wallet
        // confirmation popup, which is far better UX than N separate popups.
        toast.loading(
          `Please approve ${transactions.length} transaction${transactions.length > 1 ? "s" : ""} in your wallet…`,
          { id: toastId }
        );

        const signedTxs = await signAllTransactions(transactions);

        // ── Step 5: Send all transactions ───────────────────────────────────
        // We skip preflight on send because we already simulated above.
        // maxRetries: 5 handles transient network blips without extra code.
        toast.loading("Broadcasting transactions to the network…", {
          id: toastId,
        });

        const signatures: string[] = [];

        const sendLabel = `${labelPrefix} send`;
        console.time(sendLabel);
        try {
          for (let i = 0; i < signedTxs.length; i++) {
          toast.loading(
            `Sending batch ${i + 1} of ${signedTxs.length}…`,
            { id: toastId }
          );
          const sig = await connection.sendRawTransaction(
            signedTxs[i].serialize(),
            {
              skipPreflight: true, // Already simulated ✓
              maxRetries: 5,
            }
          );
          signatures.push(sig);
        }
        } finally {
          console.timeEnd(sendLabel);
        }

        // ── Step 6: Confirm all transactions ────────────────────────────────
        // Concurrent confirmation — no need to wait for each one sequentially.
        toast.loading("Confirming on-chain…", { id: toastId });

        const confirmLabel = `${labelPrefix} confirm`;
        console.time(confirmLabel);
        try {
          await Promise.all(
            signatures.map((sig) =>
              connection.confirmTransaction(
                { signature: sig, blockhash, lastValidBlockHeight },
                "confirmed"
              )
            )
          );
        } finally {
          console.timeEnd(confirmLabel);
        }

        // ── Step 7: Report success ───────────────────────────────────────────
        const reclaimedSol = selectedAccounts.reduce(
          (sum, a) => sum + a.rentSol,
          0
        );

        const reclaimResult: ReclaimResult = {
          signatures,
          closedCount: selectedAccounts.length,
          reclaimedSol,
        };

        setResult(reclaimResult);

        // Show success toast with link to the first signature on Solscan
        const explorerUrl = `${EXPLORER_BASE}/${signatures[0]}`;
        toast.success(
          `${selectedAccounts.length} accounts closed! Recovered ${reclaimedSol.toFixed(6)} SOL`,
          {
            id: toastId,
            duration: 10_000,
            action: {
              label: "View on Solscan",
              onClick: () => window.open(explorerUrl, "_blank"),
            },
          }
        );

        return reclaimResult;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Transaction failed";

        // Distinguish between user rejection and actual errors
        const isUserRejection =
          message.toLowerCase().includes("rejected") ||
          message.toLowerCase().includes("cancelled") ||
          message.toLowerCase().includes("user rejected");

        toast.error(isUserRejection ? "Transaction cancelled" : message, {
          id: toastId,
          duration: isUserRejection ? 3_000 : 8_000,
        });

        throw err; // Re-throw so Dashboard can handle UI state
      } finally {
        setReclaiming(false);
        console.timeEnd(overallLabel);
      }
    },
    [connection, publicKey, signAllTransactions]
  );

  return {
    reclaim,
    reclaiming,
    result,
    clearResult,
    simulationStatus,
    resetSimulation,
  };
}
