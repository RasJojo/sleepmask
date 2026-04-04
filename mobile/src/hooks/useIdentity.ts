import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useReactiveClient } from '@dynamic-labs/react-hooks';
import type { BaseWallet } from '@dynamic-labs/types';

import { clearActivity } from '../services/activity';
import { dynamicClient } from '../services/dynamic';
import { deriveUnlinkMnemonic } from '../services/identity';

const IDENTITY_KEY_PREFIX = 'sleepmask_identity_v1:';

interface IdentityState {
  mnemonic: string | null;
  wallet: BaseWallet | null;
  walletAddress: string | null;
  connectionMethod: string | null;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  connectWithGoogle: () => Promise<void>;
  connectWithApple: () => Promise<void>;
  connectWithEmail: () => Promise<void>;
  connectWithPasskey: () => Promise<void>;
  logout: () => Promise<void>;
}

function getConnectionMethod(user: any) {
  const verifiedCredentials = user?.verifiedCredentials ?? [];
  const selected =
    verifiedCredentials.find(
      (credential: any) => credential.id === user?.lastVerifiedCredentialId,
    ) ?? verifiedCredentials[0];

  if (!selected) {
    return null;
  }

  if (selected.oauthProvider === 'google') return 'Google';
  if (selected.oauthProvider === 'apple') return 'Apple';
  if (selected.format === 'email') return 'Email';
  if (selected.format === 'passkey') return 'Passkey';
  if (selected.walletName) return selected.walletName;

  return 'Dynamic';
}

export function useIdentity(): IdentityState {
  const auth = useReactiveClient(dynamicClient.auth);
  const wallets = useReactiveClient(dynamicClient.wallets);

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryWallet = wallets.primary;
  const walletAddress = primaryWallet?.address ?? null;
  const connectionMethod = useMemo(
    () => getConnectionMethod(auth.authenticatedUser),
    [auth.authenticatedUser],
  );

  useEffect(() => {
    let cancelled = false;

    async function deriveIdentity() {
      if (!primaryWallet || !walletAddress) {
        setMnemonic(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cacheKey = `${IDENTITY_KEY_PREFIX}${walletAddress.toLowerCase()}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          if (!cancelled) {
            setMnemonic(cached);
          }
          return;
        }

        const { signedMessage } = await dynamicClient.wallets.signMessage({
          wallet: primaryWallet,
          message: 'sleepmask-identity-v1',
        });

        const nextMnemonic = await deriveUnlinkMnemonic(async () => signedMessage);
        await AsyncStorage.setItem(cacheKey, nextMnemonic);

        if (!cancelled) {
          setMnemonic(nextMnemonic);
        }
      } catch (nextError: any) {
        if (!cancelled) {
          setMnemonic(null);
          setError(nextError?.message || 'Erreur dérivation identité');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    deriveIdentity().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [primaryWallet, walletAddress]);

  const runAuthAction = useCallback(
    async (action: () => Promise<unknown>, fallbackMessage: string) => {
      setLoading(true);
      setError(null);
      try {
        await action();
      } catch (nextError: any) {
        setError(nextError?.message || fallbackMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const initialize = useCallback(async () => {
    await runAuthAction(() => dynamicClient.ui.auth.show(), 'Erreur connexion');
  }, [runAuthAction]);

  const connectWithGoogle = useCallback(async () => {
    await runAuthAction(
      () => dynamicClient.auth.social.connect({ provider: 'google' }),
      'Connexion Google indisponible',
    );
  }, [runAuthAction]);

  const connectWithApple = useCallback(async () => {
    await runAuthAction(
      () => dynamicClient.auth.social.connect({ provider: 'apple' }),
      'Connexion Apple indisponible',
    );
  }, [runAuthAction]);

  const connectWithEmail = useCallback(async () => {
    await runAuthAction(() => dynamicClient.ui.auth.show(), 'Connexion email indisponible');
  }, [runAuthAction]);

  const connectWithPasskey = useCallback(async () => {
    await runAuthAction(() => dynamicClient.auth.passkey.signIn(), 'Passkey indisponible');
  }, [runAuthAction]);

  const logout = useCallback(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const identityKeys = keys.filter(key => key.startsWith(IDENTITY_KEY_PREFIX));
    if (identityKeys.length > 0) {
      await AsyncStorage.multiRemove(identityKeys);
    }
    await clearActivity();
    await dynamicClient.auth.logout();
    setMnemonic(null);
  }, []);

  return {
    mnemonic,
    wallet: primaryWallet,
    walletAddress,
    connectionMethod,
    authenticated: Boolean(auth.authenticatedUser && primaryWallet),
    loading,
    error,
    initialize,
    connectWithGoogle,
    connectWithApple,
    connectWithEmail,
    connectWithPasskey,
    logout,
  };
}
