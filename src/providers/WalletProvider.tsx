// ─────────────────────────────────────────────────────────────────────────────
// src/providers/WalletProvider.tsx
//
// Sets up the full Solana wallet adapter context for the app.
//
// Supported wallets (all auto-detected if the browser extension is installed):
//   • Phantom     — most popular Solana wallet
//   • Solflare    — strong mobile support, hardware wallet compatible
//   • Backpack    — xNFT ecosystem wallet
//   • Coinbase    — popular with web2 newcomers
//
// The ConnectionProvider wraps the app with a single shared Connection object
// pointing to Helius — our recommended RPC.
//
// autoConnect: true — re-connects the previously used wallet on page refresh
// without requiring another user interaction.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { RPC_URL } from "@/lib/constants";

// Import the default wallet-adapter modal styles.
// This can be overridden with custom CSS if needed.
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: ReactNode;
}

export function WalletProvider({ children }: Props) {
  // Wallets are memoised so adapter instances aren't recreated on every render.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),    ],
    []
  );

  return (
    <ConnectionProvider
      endpoint={RPC_URL}
      config={{
        // "confirmed" commitment: blocks are confirmed by >2/3 of validators.
        // Faster than "finalized" (~32 slots) but more reliable than "processed".
        commitment: "confirmed",
        // Disable WebSocket — we use HTTP polling for simplicity and Helius
        // free-tier compatibility. Enable wsEndpoint for real-time subscriptions.
        disableRetryOnRateLimit: false,
      }}
    >
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect={true} // Reconnect on page refresh
        onError={(error) => {
          // Wallet connection errors (user rejected, wallet locked, etc.)
          // These are handled at the component level via useWallet().
          console.warn("[WalletProvider] Wallet error:", error.message);
        }}
      >
        {/* WalletModalProvider renders the "Select Wallet" modal when 
            useWalletModal().setVisible(true) is called */}
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
