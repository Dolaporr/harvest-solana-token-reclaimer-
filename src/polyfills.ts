// src/polyfills.ts
// Ensure Buffer is available globally before any Solana deps run.

import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  (window as Window & { Buffer?: typeof Buffer }).Buffer = Buffer;
}
