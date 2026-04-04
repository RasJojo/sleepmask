import { useEffect, useState, useCallback } from 'react';
import type { BaseWallet } from '@dynamic-labs/types';

import type { ActivityItem } from '../types';
import { readActivity } from '../services/activity';
import {
  getWalletSnapshot,
  type WalletSnapshot,
} from '../services/unlink';

type Balance = {
  balances: Array<{ token: string; amount: string }>;
  unlinkAddress: string;
};

export function useBalance(mnemonic: string | null, wallet: BaseWallet | null) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mnemonic) {
      setSnapshot(null);
      setActivity([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, localActivity] = await Promise.all([
        getWalletSnapshot({ mnemonic, wallet }),
        readActivity(),
      ]);
      setSnapshot(data);
      setActivity(localActivity);
    } catch (e: any) {
      setError(e?.message || 'Erreur balance');
    } finally {
      setLoading(false);
    }
  }, [mnemonic, wallet]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const balance: Balance | null = snapshot
    ? {
        balances: snapshot.balances,
        unlinkAddress: snapshot.unlinkAddress,
      }
    : null;

  return {
    balance,
    holdings: snapshot?.holdings ?? [],
    activity,
    walletAddress: snapshot?.walletAddress ?? wallet?.address ?? null,
    unlinkAddress: snapshot?.unlinkAddress ?? null,
    loading,
    error,
    refresh,
  };
}
