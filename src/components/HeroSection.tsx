// ─────────────────────────────────────────────────────────────────────────────
// src/components/HeroSection.tsx
//
// Landing hero. Uses the real wallet modal trigger instead of a fake handler.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { ArrowDown, Shield, Zap } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const HeroSection = () => {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <section className="relative min-h-[70vh] sm:min-h-[85vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-8"
          >
            <Shield size={14} className="text-secondary" />
            <span className="text-sm font-medium text-muted-foreground">
              No fees · 100% on-chain · Open source
            </span>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight mb-6">
            <span className="text-foreground">Reclaim Your</span>
            <br />
            <span className="gradient-text glow-text-purple">SOL</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Securely close empty token accounts and recover your rent deposits
            in seconds. No fees, no risk.
          </p>

          {!connected && (
            <motion.button
              onClick={() => setVisible(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-display font-semibold text-lg btn-glow"
            >
              <Zap size={20} />
              Connect & Scan
            </motion.button>
          )}

          {connected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center"
            >
              <ArrowDown size={28} className="text-primary animate-bounce" />
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
