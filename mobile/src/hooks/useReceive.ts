/**
 * useReceive — Hook pour générer un QR de paiement et surveiller son statut.
 *
 * Usage :
 *   const { createRequest, qrData, requestId, paid, loading } = useReceive(unlinkAddress);
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "../services/api";

type UseReceiveResult = {
  createRequest: (amount?: string, ttlSeconds?: string) => Promise<void>;
  qrData: string | null;
  requestId: string | null;
  paid: boolean;
  loading: boolean;
  error: string | null;
  reset: () => void;
};

export function useReceive(unlinkAddress: string | null): UseReceiveResult {
  const [qrData, setQrData] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createRequest = useCallback(
    async (amount = "0", ttlSeconds = "3600") => {
      if (!unlinkAddress) {
        setError("Adresse Unlink manquante");
        return;
      }

      setLoading(true);
      setError(null);
      setPaid(false);

      try {
        const res = await api.createReceiveRequest({ unlinkAddress, amount, ttlSeconds });
        setQrData(res.qrData);
        setRequestId(res.requestId);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [unlinkAddress]
  );

  // Polling : vérifie toutes les 5s si la request est payée
  useEffect(() => {
    if (!requestId || paid) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.getPaymentStatus(requestId);
        if (res.paid) {
          setPaid(true);
          clearInterval(pollRef.current!);
        }
      } catch {
        // Silencieux — le polling continue
      }
    }, 5000);

    return () => clearInterval(pollRef.current!);
  }, [requestId, paid]);

  const reset = useCallback(() => {
    setQrData(null);
    setRequestId(null);
    setPaid(false);
    setError(null);
    clearInterval(pollRef.current!);
  }, []);

  return { createRequest, qrData, requestId, paid, loading, error, reset };
}
