import { useState, useCallback } from 'react';
import { getBalance, Balance } from '../services/api';

export function useBalance(mnemonic: string | null) {
  const [balance, setBalance]           = useState<Balance | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mnemonic) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBalance(mnemonic);
      setBalance(data);
    } catch (e: any) {
      setError(e?.message || 'Erreur balance');
    } finally {
      setLoading(false);
    }
  }, [mnemonic]);

  return { balance, loading, error, refresh };
}
