export const config = {
  appOrigin: 'https://sleepmask.jojoserv.com',
  backendApiUrl: 'https://sleepmask.jojoserv.com/api',
  dynamicEnvId: '066ac1d2-d0a9-455e-8282-675e1bb23615',
  identityMessage: 'sleepmask-identity-v1',
  rpcUrl: 'https://sepolia.base.org',
  unlinkApiKey: 'Fh9H5JLbtLWKDBU31EcLDE',
  unlinkEngineUrl: 'https://staging-api.unlink.xyz',
  // Canonical USDC on Base Sepolia.
  usdcToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

export const baseSepoliaNetwork = {
  chainId: 84532,
  name: 'Base Sepolia',
  chainName: 'Base Sepolia',
  iconUrls: ['https://app.dynamic.xyz/assets/networks/base.svg'],
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  networkId: 84532,
  rpcUrls: [config.rpcUrl],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
  vanityName: 'Base Sepolia',
};
