// ─────────────────────────────────────────────────────────────────────────────
// vite.config.ts
//
// @solana/web3.js and the wallet adapters depend on several Node.js built-ins
// (Buffer, process, crypto) that don't exist in the browser by default.
// Vite's `define` block polyfills them at build time.
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import { componentTagger } from "lovable-tagger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Required by @solana/web3.js and Buffer-dependent packages
    "process.env": {},
    global: "globalThis",
  },
  optimizeDeps: {
    // Pre-bundle heavy Solana packages so HMR stays fast
    include: [
      "@solana/web3.js",
      "@solana/spl-token",
      "@solana/wallet-adapter-react",
      "@solana/wallet-adapter-react-ui",
      "@solana/wallet-adapter-wallets",
    ],
    esbuildOptions: {
      // Node.js global shims for browser environment
      define: {
        global: "globalThis",
      },
    },
  },
}));
