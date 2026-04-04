/**
 * useBalance — Hook React Native pour le solde Unlink.
 *
 * Usage dans un screen :
 *   const { balance, unlinkAddress, loading, error, refresh } = useBalance(mnemonic);
 */

import { useState, useEffect, useCallback } from "react";
import { api, type BalanceResponse } from "../services/api";

type UseBalanceResult = {
  balance: string;           // Solde USDC formaté (ex: "42.00")
  unlinkAddress: string;     // Adresse unlink1...
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useBalance(mnemonic: string | null): UseBalanceResult {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!mnemonic) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBalance(mnemonic);
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mnemonic]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Trouve le solde USDC dans les balances
  const usdcBalance = data?.balances.find((b) =>
    b.token.toLowerCase().includes("usdc") ||
    b.token === "0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7"
  );

  const balance = usdcBalance
    ? (parseFloat(usdcBalance.amount) / 1e18).toFixed(2) // 18 decimals pour le token test
    : "0.00";

  return {
    balance,
    unlinkAddress: data?.unlinkAddress ?? "",
    loading,
    error,
    refresh: fetch,
  };
}
