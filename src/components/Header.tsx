// ─────────────────────────────────────────────────────────────────────────────
// src/components/Header.tsx
//
// Top navigation bar. Uses the real wallet adapter:
//   • WalletMultiButton — shows "Select Wallet" modal, or connected state
//   • useWallet()       — reads connection state for styling
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const Header = () => {
  const { connected } = useWallet();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card-strong rounded-none border-x-0 border-t-0"
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
            <span className="text-primary-foreground font-display font-bold text-sm">
              H
            </span>
            <img
              src="/harvest-icon.png"
              alt="Harvest"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <span className="font-display font-semibold text-lg text-foreground">
            Harvest
          </span>
        </div>

        {/*
         * WalletMultiButton handles all wallet connection UX out of the box:
         *   — "Select Wallet" modal with all configured adapters
         *   — Shows truncated public key once connected
         *   — Dropdown to disconnect / change wallet
         *
         * We apply custom Tailwind classes via the `style` prop to match the
         * app's design system without fighting the adapter's CSS specificity.
         */}
        <div
          className={`wallet-btn-wrapper ${
            connected ? "wallet-btn-connected" : "wallet-btn-disconnected"
          }`}
        >
          <WalletMultiButton />
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
