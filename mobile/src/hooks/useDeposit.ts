import { useState, useCallback } from 'react';
import type { BaseWallet } from '@dynamic-labs/types';

import { createActivityItem, pushActivity } from '../services/activity';
import { humanizeError } from '../services/errors';
import { depositUsdcToPrivateBalance } from '../services/unlink';

type DepositStatus = 'idle' | 'pending' | 'success' | 'error';

export function useDeposit(mnemonic: string | null, wallet: BaseWallet | null) {
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const deposit = useCallback(async (amount: string, token?: `0x${string}`) => {
    if (!mnemonic || !wallet) {
      setError('Wallet non prêt');
      return false;
    }
    setStatus('pending');
    setError(null);
    try {
      await depositUsdcToPrivateBalance({
        mnemonic,
        wallet,
        amount,
        token,
      });
      await pushActivity(
        createActivityItem({
          title: 'Dépôt vers Sleepmask',
          amountMicros: amount,
          direction: 'Reçu',
          status: 'Terminé',
          token: 'USDC',
        }),
      );
      setStatus('success');
      return true;
    } catch (e: any) {
      setError(humanizeError(e, 'Dépôt échoué'));
      setStatus('error');
      return false;
    }
  }, [mnemonic, wallet]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, deposit, reset };
}
