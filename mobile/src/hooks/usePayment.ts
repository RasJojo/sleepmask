/**
 * usePayment — Hook pour le flow de paiement ZK complet.
 *
 * Usage :
 *   const { pay, status, txId, error } = usePayment(mnemonic);
 *   await pay({ requestId, recipientUnlinkAddress, amount });
 */

import { useState, useCallback } from "react";
import { api } from "../services/api";

export type PaymentStatus = "idle" | "loading" | "success" | "error";

type PayParams = {
  requestId: string;
  recipientUnlinkAddress: string;
  amount: string;
};

type UsePaymentResult = {
  pay: (params: PayParams) => Promise<void>;
  status: PaymentStatus;
  txId: string | null;
  error: string | null;
  reset: () => void;
};

export function usePayment(mnemonic: string | null): UsePaymentResult {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    async (params: PayParams) => {
      if (!mnemonic) {
        setError("Non connecté");
        return;
      }

      setStatus("loading");
      setError(null);
      setTxId(null);

      try {
        const res = await api.pay({ mnemonic, ...params });
        setTxId(res.txId);
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
    setTxId(null);
    setError(null);
  }, []);

  return { pay, status, txId, error, reset };
}
