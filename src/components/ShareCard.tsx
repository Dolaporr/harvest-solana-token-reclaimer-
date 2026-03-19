// src/components/ShareCard.tsx
// Shareable reclaim summary card for html2canvas capture.

import { forwardRef, useMemo } from "react";

interface ShareCardProps {
  reclaimedSol: number;
  reclaimedUsd?: number | null;
  closedCount: number;
  dateLabel: string;
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ reclaimedSol, reclaimedUsd, closedCount, dateLabel }, ref) => {
    const usdFormatter = useMemo(
      () =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }),
      []
    );
    const solFormatter = useMemo(
      () =>
        new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        }),
      []
    );

    return (
      <div
        ref={ref}
        className="w-[900px] h-[520px] rounded-[32px] overflow-hidden border border-white/10 text-white"
        style={{
          backgroundImage: "url('/harvest-icon.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="h-full w-full p-10 flex flex-col justify-between relative bg-black/50">
          <div className="relative">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">
              Harvest
            </p>
            <p className="text-lg font-display font-semibold">
              Reclaim Summary
            </p>
          </div>

          <div className="relative space-y-4">
            <p className="text-4xl font-display font-bold">
              {reclaimedUsd != null
                ? `${usdFormatter.format(reclaimedUsd)} reclaimed`
                : `${solFormatter.format(reclaimedSol)} SOL reclaimed`}
            </p>
            <p className="text-white/70 text-lg">
              {closedCount} empty account{closedCount !== 1 ? "s" : ""} closed
              · {solFormatter.format(reclaimedSol)} SOL recovered
            </p>
            {reclaimedUsd != null && (
              <p className="text-white/60 text-sm">
                ≈ {solFormatter.format(reclaimedSol)} SOL at time of reclaim
              </p>
            )}
          </div>

          <div className="relative flex items-center justify-between text-sm text-white/60">
            <span>{dateLabel}</span>
            <span>harvestsolana.com</span>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";

export default ShareCard;
