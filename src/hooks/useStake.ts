// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useStake.ts
//
// Handles post-reclaim liquid staking flows (Marinade + Jito).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  Transaction,
} from "@solana/web3.js";
import {
  Marinade,
  MarinadeConfig,
  BN,
} from "@marinade.finance/marinade-ts-sdk";
import { depositSol } from "@solana/spl-stake-pool";
import { toast } from "sonner";
import { RPC_LABEL } from "@/lib/constants";

export type LiquidProvider = "marinade" | "jito";

export interface StakeResult {
  signature: string;
  stakeAccount?: string;
}

export interface LiquidStakeInput {
  amountSol: number;
  provider: LiquidProvider;
}

export function useStake() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const JITO_STAKE_POOL_ADDRESS = new PublicKey(
    "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"
  );

  const [staking, setStaking] = useState(false);

  const stakeLiquid = useCallback(
    async ({ amountSol, provider }: LiquidStakeInput): Promise<StakeResult> => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!sendTransaction)
        throw new Error("Your wallet does not support sendTransaction");

      const stakeLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
      if (!Number.isFinite(stakeLamports) || stakeLamports <= 0) {
        throw new Error("Stake amount must be greater than 0");
      }

      setStaking(true);
      const toastId = toast.loading(
        provider === "marinade"
          ? "Preparing Marinade stake..."
          : "Preparing Jito stake..."
      );
      const label = `[${RPC_LABEL}] stake-${provider}`;
      console.time(label);

      try {
        let transaction: Transaction;
        let signers: Signer[] = [];

        if (provider === "marinade") {
          const config = new MarinadeConfig({
            connection,
            publicKey,
          });
          const marinade = new Marinade(config);
          const amountLamports = new BN(stakeLamports.toString());
          const result = await marinade.deposit(amountLamports);
          transaction = result.transaction;
        } else {
          const result = await depositSol(
            connection,
            JITO_STAKE_POOL_ADDRESS,
            publicKey,
            stakeLamports
          );
          transaction = new Transaction().add(...result.instructions);
          signers = result.signers ?? [];
          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash("finalized");
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;
          const signature = await sendTransaction(transaction, connection, {
            signers,
          });
          toast.loading("Confirming stake on-chain...", { id: toastId });
          await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
          );

          toast.success("Liquid stake submitted", { id: toastId });
          return { signature };
        }

        const signature = await sendTransaction(transaction, connection);
        toast.loading("Confirming stake on-chain...", { id: toastId });
        await connection.confirmTransaction(signature, "confirmed");

        toast.success("Liquid stake submitted", { id: toastId });
        return { signature };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to liquid stake";
        toast.error(message, { id: toastId, duration: 6_000 });
        throw err;
      } finally {
        setStaking(false);
        console.timeEnd(label);
      }
    },
    [connection, publicKey, sendTransaction]
  );

  return {
    staking,
    stakeLiquid,
  };
}
