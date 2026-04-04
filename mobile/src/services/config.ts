export const config = {
  appOrigin: 'https://sleepmask.jojoserv.com',
  backendApiUrl: 'https://sleepmask.jojoserv.com/api',
  dynamicEnvId: '066ac1d2-d0a9-455e-8282-675e1bb23615',
  identityMessage: 'sleepmask-identity-v1',
  rpcUrl: 'https://sepolia.base.org',
  unlinkApiKey: 'Fh9H5JLbtLWKDBU31EcLDE',
  unlinkEngineUrl: 'https://staging-api.unlink.xyz',
  usdcToken: '0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7',
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
