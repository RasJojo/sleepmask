import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { deriveUnlinkMnemonic } from '../services/identity';

interface IdentityState {
  mnemonic:      string | null;
  unlinkAddress: string | null;
  loading:       boolean;
  error:         string | null;
  derive:        () => Promise<void>;
}

/**
 * Dérive et met en cache le mnémonique Unlink depuis le wallet Dynamic.
 * La dérivation se lance automatiquement quand l'utilisateur est connecté.
 * Le mnémonique reste en mémoire locale — jamais envoyé au backend au repos.
 */
export function useIdentity(): IdentityState {
  const { primaryWallet, user } = useDynamicContext();

  const [mnemonic, setMnemonic]           = useState<string | null>(null);
  const [unlinkAddress, setUnlinkAddress] = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const derive = useCallback(async () => {
    if (!primaryWallet) {
      setError('Aucun wallet connecté');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const signFn = async (message: string) => {
        const signed = await primaryWallet.signMessage(message);
        return signed as string;
      };
      const m = await deriveUnlinkMnemonic(signFn);
      setMnemonic(m);
      // L'adresse Unlink est récupérée via le backend au premier appel getBalance
    } catch (e: any) {
      setError(e?.message || 'Erreur dérivation identité');
    } finally {
      setLoading(false);
    }
  }, [primaryWallet]);

  // Dérive automatiquement quand l'utilisateur se connecte
  useEffect(() => {
    if (user && primaryWallet && !mnemonic) {
      derive();
    }
  }, [user, primaryWallet, mnemonic, derive]);

  return { mnemonic, unlinkAddress, loading, error, derive };
}
