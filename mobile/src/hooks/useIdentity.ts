import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useReactiveClient } from '@dynamic-labs/react-hooks';

import { clearActivity } from '../services/activity';
import { config } from '../services/config';
import { dynamicClient } from '../services/dynamic';
import { deriveUnlinkMnemonic } from '../services/identity';

const IDENTITY_KEY_PREFIX = 'sleepmask_identity_v1:';

interface IdentityState {
  mnemonic:         string | null;
  wallet:           any | null;
  walletAddress:    string | null;
  connectionMethod: string | null;
  authenticated:    boolean;
  loading:          boolean;
  error:            string | null;
  initialize:       () => Promise<void>;
  logout:           () => Promise<void>;
}

function getConnectionMethod(user: any, walletKey: string | undefined) {
  const creds = user?.verifiedCredentials ?? [];
  const sel = creds.find((c: any) => c.id === user?.lastVerifiedCredentialId) ?? creds[0];
  if (sel?.oauthProvider === 'google') return 'Google';
  if (sel?.oauthProvider === 'apple')  return 'Apple';
  if (sel?.format === 'email')         return 'Email';
  if (sel?.format === 'passkey')       return 'Passkey';
  if (walletKey === 'metamask')        return 'MetaMask';
  if (walletKey)                       return walletKey.charAt(0).toUpperCase() + walletKey.slice(1);
  return 'Dynamic';
}

export function useIdentity(): IdentityState {
  const client  = useReactiveClient(dynamicClient as any);
  const auth    = (client as any).auth;
  const wallets = (client as any).wallets;
  const sdk     = (client as any).sdk;

  const [mnemonic, setMnemonic]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const openingAuthRef                    = useRef(false);
  const reactivePrimaryWallet             = wallets?.primary ?? null;
  const reactiveUserWallets               = wallets?.userWallets ?? [];
  const primaryWallet                     = useMemo(
    () => reactivePrimaryWallet ?? reactiveUserWallets[0] ?? null,
    [reactivePrimaryWallet, reactiveUserWallets],
  );
  const user                              = auth?.authenticatedUser ?? null;
  const isDynamicAuthenticated            = Boolean(
    user || primaryWallet || reactiveUserWallets.length > 0,
  );

  useEffect(() => {
    let cancelled = false;

    const reconcileWalletState = async () => {
      try {
        await sdk?.waitForReady?.();
      } catch {
        // Best effort only.
      }

      try {
        const pulledState = await wallets?.getWalletsState?.();
        if (cancelled || !pulledState) {
          return;
        }

        const candidateWallet =
          pulledState.primary ?? pulledState.userWallets?.[0] ?? null;

        if (
          candidateWallet &&
          !pulledState.primary &&
          wallets?.setPrimary &&
          (candidateWallet as any).id
        ) {
          await wallets.setPrimary({ walletId: (candidateWallet as any).id });
        }

        if (!auth?.authenticatedUser && candidateWallet) {
          try {
            await auth?.refreshUser?.();
          } catch {
            // Best effort only.
          }
        }
      } catch {
        // Best effort only.
      }
    };

    reconcileWalletState().catch(() => undefined);

    const offLoaded = sdk?.on?.('loadedChanged', (loaded: boolean) => {
      if (loaded) {
        reconcileWalletState().catch(() => undefined);
      }
    });
    const offWalletAdded = wallets?.on?.('walletAdded', () => {
      reconcileWalletState().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      offLoaded?.();
      offWalletAdded?.();
    };
  }, [auth, sdk, wallets]);

  // Keep the login UI state coherent with the Dynamic auth lifecycle.
  useEffect(() => {
    const offAuthSuccess = auth?.on?.('authSuccess', () => {
      setLoading(false);
      setError(null);
    });
    const offWalletReturn = wallets?.on?.('walletReturnFromDeepLink', async () => {
      try {
        await auth?.refreshUser?.();
      } catch {
        // Best effort only; authFailed handler below will surface real failures.
      }
    });
    const offAuthFailed = auth?.on?.('authFailed', (_payload: any, reason: any) => {
      const reasonMessage =
        typeof reason === 'string'
          ? reason
          : reason?.message || reason?.name || null;
      setError(reasonMessage ? `Connexion échouée: ${reasonMessage}` : 'Connexion échouée');
      setLoading(false);
      openingAuthRef.current = false;
    });
    const offLoggedOut = auth?.on?.('loggedOut', () => {
      setLoading(false);
      setError(null);
    });

    return () => {
      offAuthSuccess?.();
      offWalletReturn?.();
      offAuthFailed?.();
      offLoggedOut?.();
    };
  }, [auth, wallets]);

  // When returning from external wallet apps (MetaMask), force a user refresh.
  // Some devices/flows don't always emit walletReturnFromDeepLink reliably.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;

      (async () => {
        try {
          await sdk.waitForReady();
        } catch {
          // Best effort only.
        }

        const currentWallet = wallets?.primary ?? wallets?.userWallets?.[0] ?? null;
        const currentUser = auth?.authenticatedUser ?? null;

        if (currentWallet && !currentUser) {
          try {
            await auth?.refreshUser?.();
            return;
          } catch {
            // Ignore and fall through.
          }
        }
      })().catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [auth, wallets, sdk]);

  const walletAddress    = primaryWallet?.address ?? null;
  const connectionMethod = useMemo(
    () => getConnectionMethod(user, primaryWallet?.key),
    [user, primaryWallet],
  );

  // Quand le wallet est connecté : charge le mnémonique du cache ou le dérive
  useEffect(() => {
    if (!isDynamicAuthenticated || !primaryWallet || !walletAddress) {
      setMnemonic(null);
      return;
    }

    let cancelled = false;

    async function deriveOrLoad() {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = `${IDENTITY_KEY_PREFIX}${walletAddress!.toLowerCase()}`;
        const cached   = await AsyncStorage.getItem(cacheKey);

        if (cached) {
          if (!cancelled) setMnemonic(cached);
          return;
        }

        // Première fois : signe pour dériver le mnémonique
        const { signedMessage } = await dynamicClient.wallets.signMessage({
          wallet:  primaryWallet,
          message: config.identityMessage,
        });

        const derived = await deriveUnlinkMnemonic(async () => signedMessage);
        await AsyncStorage.setItem(cacheKey, derived);
        if (!cancelled) setMnemonic(derived);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur dérivation identité');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    deriveOrLoad().catch(() => undefined);
    return () => { cancelled = true; };
  }, [isDynamicAuthenticated, primaryWallet, walletAddress]);

  const initialize = useCallback(async () => {
    if (openingAuthRef.current) {
      return;
    }

    openingAuthRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Prevent race conditions: wait until Dynamic restored persisted session state.
      await sdk?.waitForReady?.();

      const pulledState = await wallets?.getWalletsState?.();
      const restoredWallet =
        pulledState?.primary ??
        pulledState?.userWallets?.[0] ??
        wallets?.primary ??
        null;
      if (
        restoredWallet &&
        !wallets?.primary &&
        wallets?.setPrimary &&
        (restoredWallet as any).id
      ) {
        try {
          await wallets.setPrimary({ walletId: (restoredWallet as any).id });
        } catch {
          // Best effort only.
        }
      }

      let restoredUser = auth?.authenticatedUser ?? null;
      if (!restoredUser) {
        try {
          restoredUser = await auth?.refreshUser?.();
        } catch {
          restoredUser = null;
        }
      }

      if (restoredWallet || restoredUser) {
        return;
      }

      await dynamicClient.ui.auth.show();
    } catch (e: any) {
      setError(e?.message || 'Erreur connexion');
    } finally {
      openingAuthRef.current = false;
      setLoading(false);
    }
  }, [auth, sdk, wallets]);

  const logout = useCallback(async () => {
    const keys         = await AsyncStorage.getAllKeys();
    const identityKeys = keys.filter(k => k.startsWith(IDENTITY_KEY_PREFIX));
    if (identityKeys.length > 0) await AsyncStorage.multiRemove(identityKeys);
    await clearActivity();
    await auth?.logout?.();
    setMnemonic(null);
  }, [auth]);

  return {
    mnemonic,
    wallet: primaryWallet,
    walletAddress,
    connectionMethod,
    authenticated: isDynamicAuthenticated,
    loading,
    error,
    initialize,
    logout,
  };
}
