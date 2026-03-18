// src/lib/analytics.ts
//
// Minimal Plausible Analytics helper for client-side tracking.

type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: PlausibleProps }) => void;
  }
}

export function initAnalytics() {
  if (typeof document === "undefined") return;
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    return;
  }

  if (typeof window !== "undefined") {
    const stub = (...args: unknown[]) => {
      const queue = (stub as { q?: unknown[] }).q || [];
      queue.push(args);
      (stub as { q?: unknown[] }).q = queue;
    };
    window.plausible = stub as Window["plausible"];
  }
}

export function trackEvent(event: string, props?: PlausibleProps) {
  if (typeof window === "undefined") return;
  const plausible = window.plausible;
  if (typeof plausible !== "function") return;
  plausible(event, props ? { props } : undefined);
}
