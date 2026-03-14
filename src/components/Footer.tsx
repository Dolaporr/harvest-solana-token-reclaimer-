// src/components/Footer.tsx
// Simple tip jar footer with copy-to-clipboard wallet address.

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

const TIP_WALLET_ADDRESS = "4Yj9c5onRTYGVTYPynBKx73phEFKckeSfF2GZfPExfYb";

const Footer = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(TIP_WALLET_ADDRESS);
      setCopied(true);
      toast.success("Wallet address copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Please copy manually.");
    }
  };

  return (
    <footer className="container pb-12">
      <div className="glass-card-strong glow-border-purple p-5 sm:p-6 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-lg text-foreground">
              Support the project ejeh, tip here abeg
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Copy the wallet address and send a tip if you like what you see sir.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="w-full sm:w-auto flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
            aria-label="Copy tip wallet address"
          >
            <span className="font-mono text-xs sm:text-sm break-all">
              {TIP_WALLET_ADDRESS}
            </span>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
