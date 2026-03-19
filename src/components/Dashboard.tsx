// ─────────────────────────────────────────────────────────────────────────────
// src/components/Dashboard.tsx
//
// The heart of the dApp. Fully wired to real Solana logic via two hooks:
//   • useTokenAccounts  — scanning (RPC calls, filtering, metadata)
//   • useReclaimAccounts — transaction build → simulate → sign → send → confirm
//
// State machine:
//   idle      → user clicks "Scan"
//   scanning  → RPC calls in flight
//   results   → accounts listed, user selects, clicks "Reclaim"
//   reclaiming → txs being built / simulated / signed / confirmed
//   success   → all txs confirmed, success card shown
//   empty     → scan returned 0 empty accounts
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  Search,
  Coins,
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Zap,
  Info,
  Download,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useTokenAccounts } from "@/hooks/useTokenAccounts";
import { useReclaimAccounts } from "@/hooks/useReclaimAccounts";
import { CLOSE_ACCOUNTS_BATCH_SIZE, EXPLORER_BASE } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import ShareCard from "@/components/ShareCard";

// ─────────────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const {
    accounts,
    scanning,
    error: scanError,
    hasScanned,
    scan,
    toggleAccount,
    toggleAll,
    removeAccounts,
    reset,
    selected,
    totalReclaimableSol,
    allSelected,
  } = useTokenAccounts();

  const {
    reclaim,
    reclaiming,
    result,
    clearResult,
    simulationStatus,
    resetSimulation,
  } = useReclaimAccounts();

  // Track whether the initial "idle" state has been left
  const [started, setStarted] = useState(false);
  const prevConnected = useRef(connected);
  const lastReclaimId = useRef<string>("");
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleScan = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    trackEvent("scan_started");
    setStarted(true);
    await scan();
  };

  useEffect(() => {
    if (!connected) {
      reset();
      clearResult();
      setStarted(false);
    }
  }, [connected, reset, clearResult]);

  useEffect(() => {
    if (connected && !prevConnected.current) {
      trackEvent("wallet_connected");
    }
    prevConnected.current = connected;
  }, [connected]);

  const selectedKey = useMemo(
    () => selected.map((account) => account.id).join("|"),
    [selected]
  );

  useEffect(() => {
    if (!reclaiming) resetSimulation();
  }, [selectedKey, reclaiming, resetSimulation]);

  const handleReclaim = async () => {
    try {
      trackEvent("reclaim_started", { accounts: selected.length });
      const reclaimResult = await reclaim(selected);
      // Remove closed accounts from list so the remaining ones (if any) are shown
      removeAccounts(new Set(selected.map((a) => a.id)));
      // If all accounts were selected and closed, the success screen shows automatically
      // via `result` being set in the hook.
      void reclaimResult;
    } catch {
      // Errors are already surfaced via Sonner toasts in the hook.
    }
  };

  const handleShare = async () => {
    if (!result || !shareCardRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Failed to create image");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `harvest-reclaim-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Could not generate share card");
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    const id = result.signatures.join("|");
    if (!id || id === lastReclaimId.current) return;
    lastReclaimId.current = id;
    trackEvent("reclaim_complete", {
      accounts: result.closedCount,
      transactions: result.signatures.length,
    });
  }, [result]);

  // How many tx batches will be needed
  const batchCount = Math.ceil(selected.length / CLOSE_ACCOUNTS_BATCH_SIZE);

  const solPriceUsd = Number(import.meta.env.VITE_SOL_PRICE_USD);
  const hasUsdPrice = Number.isFinite(solPriceUsd) && solPriceUsd > 0;

  const usdFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    []
  );
  const solFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }),
    []
  );
  const shareDateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );
  const [animatedUsdText, setAnimatedUsdText] = useState(() =>
    usdFormatter.format(0)
  );
  const [animatedSolText, setAnimatedSolText] = useState(() =>
    solFormatter.format(0)
  );

  const reclaimedUsd =
    result && hasUsdPrice ? result.reclaimedSol * solPriceUsd : null;

  useEffect(() => {
    if (!result) {
      setAnimatedUsdText(usdFormatter.format(0));
      setAnimatedSolText(solFormatter.format(0));
      return;
    }
    if (hasUsdPrice) {
      const controls = animate(0, reclaimedUsd ?? 0, {
        duration: 1.2,
        ease: "easeOut",
        onUpdate: (value) => setAnimatedUsdText(usdFormatter.format(value)),
      });
      return () => controls.stop();
    }
    const controls = animate(0, result.reclaimedSol, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (value) => setAnimatedSolText(solFormatter.format(value)),
    });
    return () => controls.stop();
  }, [result, hasUsdPrice, reclaimedUsd, usdFormatter, solFormatter]);

  const selectedToken2022Count = selected.filter(
    (account) => account.program === "token-2022"
  ).length;
  const selectedLegacyCount = selected.length - selectedToken2022Count;
  const destination = publicKey?.toBase58();
  const destinationShort = destination
    ? `${destination.slice(0, 4)}…${destination.slice(-4)}`
    : "your wallet";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="container pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card-strong glow-border-purple p-6 sm:p-8 max-w-3xl mx-auto"
      >
        <AnimatePresence mode="wait">

          {/* ── IDLE: Not yet scanned ─────────────────────────────────────── */}
          {!started && !scanning && !hasScanned && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-16 gap-6"
            >
              <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center">
                <Search size={32} className="text-primary" />
              </div>
              <div className="text-center max-w-sm">
                <p className="font-display font-semibold text-lg text-foreground">
                  Ready to Scan
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click below to find all empty token accounts in your wallet
                  across both Token and Token-2022 programs.
                </p>
              </div>
              <motion.button
                onClick={handleScan}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-display font-semibold btn-glow"
              >
                <Search size={18} />
                Scan Wallet
              </motion.button>
            </motion.div>
          )}

          {/* ── SCANNING ──────────────────────────────────────────────────── */}
          {scanning && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-16 gap-6"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center scanning-pulse">
                  <Search size={32} className="text-primary" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              </div>
              <div className="text-center">
                <p className="font-display font-semibold text-lg text-foreground">
                  Scanning Wallet…
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Querying Token + Token-2022 programs via Helius
                </p>
              </div>
            </motion.div>
          )}

          {/* ── SCAN ERROR ────────────────────────────────────────────────── */}
          {!scanning && scanError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-16 gap-6"
            >
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/30">
                <AlertTriangle size={36} className="text-destructive" />
              </div>
              <div className="text-center max-w-sm">
                <p className="font-display font-semibold text-lg text-foreground">
                  Scan Failed
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-mono break-all">
                  {scanError}
                </p>
              </div>
              <button
                onClick={handleScan}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </motion.div>
          )}

          {/* ── EMPTY: No accounts found ─────────────────────────────────── */}
          {!scanning && !scanError && hasScanned && accounts.length === 0 && !result && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-16 gap-6"
            >
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center border border-secondary/30">
                <CheckCircle2 size={40} className="text-secondary" />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl text-foreground">
                  All Clean!
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  No empty token accounts found in this wallet.
                </p>
                <p className="text-sm text-secondary font-semibold mt-2">
                  Buy more tickers man.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => {
                    reset();
                    setStarted(false);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
                >
                  Back
                </button>
                <button
                  onClick={handleScan}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
                >
                  <RefreshCw size={16} />
                  Rescan
                </button>
              </div>
            </motion.div>
          )}

          {/* ── RESULTS: Accounts listed ─────────────────────────────────── */}
          {!scanning && !scanError && accounts.length > 0 && !result && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* ── Header ─────────────────────────────────────────────────── */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground">
                    Empty Accounts Found
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {accounts.length} account{accounts.length !== 1 ? "s" : ""}{" "}
                    ·{" "}
                    <span className="text-secondary font-semibold">
                      {totalReclaimableSol.toFixed(6)} SOL
                    </span>{" "}
                    recoverable
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleScan}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Rescan wallet"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={toggleAll}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>

              {/* ── Account List ──────────────────────────────────────────── */}
              <div className="space-y-2 max-h-72 sm:max-h-80 overflow-y-auto pr-1">
                {accounts.map((account, i) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                      account.selected
                        ? "bg-primary/5 border-primary/20"
                        : "bg-muted/30 border-border hover:border-muted-foreground/20"
                    }`}
                    onClick={() => toggleAccount(account.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={account.selected}
                        onCheckedChange={() => toggleAccount(account.id)}
                        className="border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Token logo or fallback icon */}
                      {account.logo ? (
                        <img
                          src={account.logo}
                          alt={account.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {account.symbol.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {account.displayName}
                          </p>
                          {/* Token-2022 badge */}
                          {account.program === "token-2022" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono leading-none">
                              T22
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {account.mintShort}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Coins size={14} className="text-secondary" />
                      <span className="text-sm font-semibold text-secondary font-mono">
                        {account.rentSol.toFixed(6)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ── Footer / Reclaim CTA ─────────────────────────────────── */}
              <div className="mt-6 pt-6 border-t border-border">
                {/* Batch info banner — shown when >20 accounts selected */}
                {batchCount > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20"
                  >
                    <Info size={14} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {selected.length} accounts selected →{" "}
                      <span className="text-foreground font-medium">
                        {batchCount} transactions
                      </span>{" "}
                      will be batched (max 20 per tx). Your wallet will ask you
                      to approve all at once.
                    </p>
                  </motion.div>
                )}

                <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck size={14} className="text-secondary" />
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Preview & Safety
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    You're closing {selected.length} empty account
                    {selected.length !== 1 ? "s" : ""} (
                    {selectedLegacyCount} Token, {selectedToken2022Count} Token-2022).
                    Rent refunds go to {destinationShort}. No token transfers.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-secondary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Only empty accounts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          We filter zero-balance accounts before closing.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={16} className="text-secondary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Refunds to your wallet
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Destination: {destinationShort}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-secondary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          No token transfers
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Only rent lamports are reclaimed.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      {simulationStatus === "running" ? (
                        <Loader2
                          size={16}
                          className="text-primary mt-0.5 animate-spin"
                        />
                      ) : simulationStatus === "passed" ? (
                        <CheckCircle2 size={16} className="text-secondary mt-0.5" />
                      ) : simulationStatus === "failed" ? (
                        <AlertTriangle
                          size={16}
                          className="text-destructive mt-0.5"
                        />
                      ) : (
                        <Info size={16} className="text-muted-foreground mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Simulation
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {simulationStatus === "passed"
                            ? "Simulation passed. Safe to sign."
                            : simulationStatus === "running"
                            ? "Running simulation before signing."
                            : simulationStatus === "failed"
                            ? "Simulation failed. Please retry."
                            : "We simulate every transaction before signing."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total to Reclaim
                    </p>
                    {/* Dynamic counter updates as user toggles checkboxes */}
                    <motion.p
                      key={totalReclaimableSol.toFixed(6)}
                      initial={{ scale: 0.97, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="font-display font-bold text-2xl gradient-text"
                    >
                      {totalReclaimableSol.toFixed(6)} SOL
                    </motion.p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasUsdPrice
                        ? `≈ ${usdFormatter.format(
                            totalReclaimableSol * solPriceUsd
                          )}`
                        : "USD estimate unavailable"}
                    </p>
                  </div>

                  <motion.button
                    onClick={handleReclaim}
                    disabled={selected.length === 0 || reclaiming}
                    whileHover={
                      selected.length > 0 && !reclaiming
                        ? { scale: 1.02 }
                        : {}
                    }
                    whileTap={
                      selected.length > 0 && !reclaiming
                        ? { scale: 0.98 }
                        : {}
                    }
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground font-display font-semibold glow-border-emerald disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {reclaiming ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Reclaim {selected.length} Account
                        {selected.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SUCCESS ───────────────────────────────────────────────────── */}
          {result && (
            <motion.div
              key="reclaimed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-16 gap-6"
            >
              <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center glow-border-emerald">
                <CheckCircle2 size={40} className="text-secondary" />
              </div>

              <div className="text-center">
                <p className="font-display font-bold text-2xl text-foreground">
                  {hasUsdPrice ? (
                    <>
                      <span>{animatedUsdText}</span> reclaimed!
                    </>
                  ) : (
                    <>
                      <span>{animatedSolText}</span> SOL reclaimed!
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasUsdPrice
                    ? `≈ ${solFormatter.format(result.reclaimedSol)} SOL`
                    : "USD estimate unavailable"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {result.closedCount} account
                  {result.closedCount !== 1 ? "s" : ""} closed across{" "}
                  {result.signatures.length} transaction
                  {result.signatures.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div
                style={{ position: "fixed", left: "-10000px", top: 0 }}
                aria-hidden
              >
                <ShareCard
                  ref={shareCardRef}
                  reclaimedSol={result.reclaimedSol}
                  reclaimedUsd={reclaimedUsd}
                  closedCount={result.closedCount}
                  dateLabel={shareDateLabel}
                />
              </div>

              {/* Transaction links */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {result.signatures.map((sig, i) => (
                  <a
                    key={sig}
                    href={`${EXPLORER_BASE}/${sig}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-secondary/40 transition-all font-mono"
                  >
                    <ExternalLink size={12} />
                    {result.signatures.length > 1
                      ? `Tx ${i + 1}: `
                      : "View on Solscan: "}
                    {sig.slice(0, 8)}…{sig.slice(-6)}
                  </a>
                ))}
              </div>

              <button
                onClick={handleShare}
                disabled={sharing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download size={16} />
                {sharing ? "Preparing…" : "Download Card"}
              </button>

              {/* Scan again if there are still accounts remaining */}
              {accounts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {accounts.length} account{accounts.length !== 1 ? "s" : ""}{" "}
                  still listed above.
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={clearResult}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
                >
                  Back to Accounts
                </button>

                {accounts.length === 0 && (
                  <button
                    onClick={() => {
                      setStarted(false);
                      void scan();
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
                  >
                    <RefreshCw size={16} />
                    Scan Again
                  </button>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </section>
  );
};

export default Dashboard;
