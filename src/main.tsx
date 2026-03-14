// ─────────────────────────────────────────────────────────────────────────────
// src/main.tsx
//
// Entry point. Injects the Buffer polyfill before anything else loads.
// @solana/web3.js assumes Buffer is available globally (it's a Node built-in);
// this import provides it in the browser via the 'buffer' npm package.
// ─────────────────────────────────────────────────────────────────────────────

import { Buffer } from "buffer";
(window as Window & { Buffer?: typeof Buffer }).Buffer = Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
