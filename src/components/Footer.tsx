// src/components/Footer.tsx
// Simple footer with copy-to-clipboard contract address.

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

const HARVEST_CONTRACT_ADDRESS = "eTmonX1jgecCgfbTn85drHJTqNHwWHgFJEYmL9gpump";

const Footer = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(HARVEST_CONTRACT_ADDRESS);
      setCopied(true);
      toast.success("Contract address copied");
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
              Support the project.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You can support the project by getting $HARVEST.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all font-medium text-sm"
            aria-label="Copy contract address"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Contract Copied" : "Copy Contract Address"}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
