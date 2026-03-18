// ─────────────────────────────────────────────────────────────────────────────
// src/main.tsx
//
// Entry point. Injects the Buffer polyfill before anything else loads.
// @solana/web3.js assumes Buffer is available globally (it's a Node built-in);
// this import provides it in the browser via the 'buffer' npm package.
// ─────────────────────────────────────────────────────────────────────────────

import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initAnalytics } from "./lib/analytics";
import "./index.css";

initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
