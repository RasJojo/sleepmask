import { useState, useEffect, useCallback, useRef } from 'react';
import { createActivityItem, pushActivity } from '../services/activity';
import {
  createReceiveRequest,
  getPaymentStatus,
  ReceiveRequest,
} from '../services/api';
import { humanizeError } from '../services/errors';

type ReceiveStatus = 'idle' | 'pending' | 'paid' | 'error';

export function useReceive(unlinkAddress: string | null) {
  const [status, setStatus] = useState<ReceiveStatus>('idle');
  const [request, setRequest] = useState<
    (ReceiveRequest & { requestedAmount: string; flexibleAmount: boolean }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createRequest = useCallback(async (params: {
    amount?: string;
    flexibleAmount?: boolean;
    ttlSeconds?: string;
    token?: string;
  }) => {
    if (!unlinkAddress) {
      setError('Adresse Unlink non disponible');
      return;
    }
    setStatus('pending');
    setError(null);
    try {
      const data = await createReceiveRequest({ unlinkAddress, ...params });
      setRequest({
        ...data,
        requestedAmount: params.amount ?? '0',
        flexibleAmount: Boolean(params.flexibleAmount),
      });

      if (pollRef.current) {
        clearInterval(pollRef.current);
      }

      pollRef.current = setInterval(() => {
        (async () => {
          try {
            const { paid } = await getPaymentStatus(data.requestId);
            if (!paid) {
              return;
            }

            setStatus('paid');
            if (pollRef.current) {
              clearInterval(pollRef.current);
            }
            await pushActivity(
              createActivityItem({
                title: 'Paiement reçu',
                amountMicros: params.flexibleAmount
                  ? 0
                  : params.amount ?? '0',
                direction: 'Reçu',
                status: 'Terminé',
                subtitle: params.flexibleAmount
                  ? 'Montant libre · confirmé'
                  : undefined,
              }),
            );
          } catch (pollError: any) {
            setError(humanizeError(pollError, 'Erreur suivi paiement'));
          }
        })().catch((pollError: any) => {
          setError(humanizeError(pollError, 'Erreur suivi paiement'));
        });
      }, 5000);
    } catch (e: any) {
      setError(humanizeError(e, 'Erreur création request'));
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
