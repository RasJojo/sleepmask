import React from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { DynamicWaasEVMConnectors } from '@dynamic-labs/waas-evm';

const DYNAMIC_ENV_ID = process.env.DYNAMIC_ENV_ID || '066ac1d2-d0a9-455e-8282-675e1bb23615';

/**
 * Provider Dynamic — embedded wallet EVM + WalletConnect.
 *
 * DynamicWaasEVMConnectors : wallet MPC non-custodial géré par Dynamic.
 * L'utilisateur se connecte via email/social → Dynamic crée un embedded wallet EVM.
 * Ce wallet signe le message "sleepay-identity-v1" → dérivation du mnémonique Unlink.
 *
 * WalletConnect est activé automatiquement par Dynamic pour les utilisateurs
 * qui préfèrent leur propre wallet (MetaMask Mobile, Rainbow, etc.).
 */
export function DynamicProvider({ children }: { children: React.ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [DynamicWaasEVMConnectors],
        // Affiche le modal Dynamic pour connexion email/social/wallet
        initialAuthenticationMode: 'connect-and-sign',
        // Réseau cible : Base Sepolia
        overrides: {
          evmNetworks: [
            {
              chainId: 84532,
              chainName: 'Base Sepolia',
              iconUrls: ['https://app.dynamic.xyz/assets/networks/base.svg'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              networkId: 84532,
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://base-sepolia.blockscout.com'],
              vanityName: 'Base Sepolia',
            },
          ],
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
