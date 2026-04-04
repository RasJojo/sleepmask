import { useState, useCallback } from 'react';
import { depositUsdc } from '../services/api';

type DepositStatus = 'idle' | 'pending' | 'success' | 'error';

export function useDeposit(mnemonic: string | null) {
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const deposit = useCallback(async (amount: string, token?: string) => {
    if (!mnemonic) { setError('Identité non dérivée'); return; }
    setStatus('pending');
    setError(null);
    try {
      await depositUsdc(mnemonic, amount, token);
      setStatus('success');
    } catch (e: any) {
      setError(e?.message || 'Dépôt échoué');
      setStatus('error');
    }
  }, [mnemonic]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, deposit, reset };
}
