import { useState, useCallback } from 'react';
import { pay, payDirect } from '../services/api';

type PayStatus = 'idle' | 'pending' | 'success' | 'error';

export function usePayment(mnemonic: string | null) {
  const [status, setStatus] = useState<PayStatus>('idle');
  const [txId, setTxId]     = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);

  // Cas 1 — Sleepmask → Sleepmask (via requestId on-chain)
  const payRequest = useCallback(async (params: {
    requestId:              string;
    recipientUnlinkAddress: string;
    amount:                 string;
    token?:                 string;
  }) => {
    if (!mnemonic) { setError('Identité non dérivée'); return; }
    setStatus('pending');
    setError(null);
    try {
      const res = await pay({ mnemonic, ...params });
      setTxId(res.txId);
      setStatus('success');
    } catch (e: any) {
      setError(e?.message || 'Paiement échoué');
      setStatus('error');
    }
  }, [mnemonic]);

  // Cas 2 — Sleepmask → wallet classique (adresse EVM directe)
  const payEvm = useCallback(async (params: {
    recipientEvmAddress: string;
    amount:              string;
    token?:              string;
  }) => {
    if (!mnemonic) { setError('Identité non dérivée'); return; }
    setStatus('pending');
    setError(null);
    try {
      const res = await payDirect({ mnemonic, ...params });
      setTxId(res.txId);
      setStatus('success');
    } catch (e: any) {
      setError(e?.message || 'Paiement échoué');
      setStatus('error');
    }
  }, [mnemonic]);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxId(null);
    setError(null);
  }, []);

  return { status, txId, error, payRequest, payEvm, reset };
}
