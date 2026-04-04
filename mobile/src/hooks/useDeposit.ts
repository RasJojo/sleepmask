/**
 * useDeposit — Hook pour déposer des tokens dans la pool Unlink.
 *
 * Usage :
 *   const { deposit, status, error } = useDeposit(mnemonic);
 *   await deposit("10000000000000000000"); // 1 token (18 decimals)
 */

import { useState, useCallback } from "react";
import { api } from "../services/api";

export type DepositStatus = "idle" | "loading" | "success" | "error";

type UseDepositResult = {
  deposit: (amount: string) => Promise<void>;
  status: DepositStatus;
  error: string | null;
  reset: () => void;
};

export function useDeposit(mnemonic: string | null): UseDepositResult {
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (amount: string) => {
      if (!mnemonic) {
        setError("Non connecté");
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        await api.deposit(mnemonic, amount);
        setStatus("success");
      } catch (e: any) {
        setError(e.message);
        setStatus("error");
      }
    },
    [mnemonic]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { deposit, status, error, reset };
}
