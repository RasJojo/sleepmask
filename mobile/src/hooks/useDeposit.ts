import { useState, useCallback } from 'react';
import type { BaseWallet } from '@dynamic-labs/types';

import { createActivityItem, pushActivity } from '../services/activity';
import { depositUsdcToPrivateBalance } from '../services/unlink';

type DepositStatus = 'idle' | 'pending' | 'success' | 'error';

export function useDeposit(mnemonic: string | null, wallet: BaseWallet | null) {
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const deposit = useCallback(async (amount: string, token?: string) => {
    if (!mnemonic || !wallet) {
      setError('Wallet non prêt');
      return;
    }
    setStatus('pending');
    setError(null);
    try {
      await depositUsdcToPrivateBalance({
        mnemonic,
        wallet,
        amount,
      });
      await pushActivity(
        createActivityItem({
          title: 'Dépôt vers le rail privé',
          amountMicros: amount,
          direction: 'Reçu',
          status: 'Terminé',
          token,
        }),
      );
      setStatus('success');
    } catch (e: any) {
      setError(e?.message || 'Dépôt échoué');
      setStatus('error');
    }
  }, [mnemonic, wallet]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, deposit, reset };
}
