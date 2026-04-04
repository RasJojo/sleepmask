import { useState, useEffect, useCallback, useRef } from 'react';
import { createReceiveRequest, getPaymentStatus, ReceiveRequest } from '../services/api';

type ReceiveStatus = 'idle' | 'pending' | 'paid' | 'error';

export function useReceive(unlinkAddress: string | null) {
  const [status, setStatus]             = useState<ReceiveStatus>('idle');
  const [request, setRequest]           = useState<ReceiveRequest | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const pollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);

  const createRequest = useCallback(async (params: {
    amount?:     string;
    ttlSeconds?: string;
    token?:      string;
  }) => {
    if (!unlinkAddress) { setError('Adresse Unlink non disponible'); return; }
    setStatus('pending');
    setError(null);
    try {
      const data = await createReceiveRequest({ unlinkAddress, ...params });
      setRequest(data);
      // Démarre le polling toutes les 5s pour détecter le paiement
      pollRef.current = setInterval(async () => {
        const { paid } = await getPaymentStatus(data.requestId);
        if (paid) {
          setStatus('paid');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } catch (e: any) {
      setError(e?.message || 'Erreur création request');
      setStatus('error');
    }
  }, [unlinkAddress]);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus('idle');
    setRequest(null);
    setError(null);
  }, []);

  // Nettoyage au démontage
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return { status, request, error, createRequest, reset };
}
