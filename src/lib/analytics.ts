// src/lib/analytics.ts
//
// Minimal Plausible Analytics helper for client-side tracking.

type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: PlausibleProps }) => void;
  }
}

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as
  | string
  | undefined;
const PLAUSIBLE_SRC =
  (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ||
  "https://plausible.io/js/script.js";

export function initAnalytics() {
  if (!PLAUSIBLE_DOMAIN) return;
  if (typeof document === "undefined") return;

  if (typeof window !== "undefined" && typeof window.plausible !== "function") {
    const stub = (...args: unknown[]) => {
      const queue = (stub as { q?: unknown[] }).q || [];
      queue.push(args);
      (stub as { q?: unknown[] }).q = queue;
    };
    window.plausible = stub as Window["plausible"];
  }

  const existing = document.querySelector("script[data-plausible]");
  if (existing) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = PLAUSIBLE_SRC;
  script.dataset.domain = PLAUSIBLE_DOMAIN;
  script.dataset.plausible = "true";
  document.head.appendChild(script);
}

export function trackEvent(event: string, props?: PlausibleProps) {
  if (typeof window === "undefined") return;
  const plausible = window.plausible;
  if (typeof plausible !== "function") return;
  plausible(event, props ? { props } : undefined);
}
