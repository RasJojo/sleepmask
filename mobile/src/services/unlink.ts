import type { BaseWallet } from '@dynamic-labs/types';
import { createUnlink, unlinkAccount, unlinkEvm } from '@unlink-xyz/sdk';
import { formatUnits, http, createPublicClient, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';

import type { Holding } from '../types';
import { dynamicClient } from './dynamic';
import { config } from './config';

const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
]);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(config.rpcUrl),
});

export type WalletSnapshot = {
  balances: Array<{ token: string; amount: string }>;
  holdings: Holding[];
  unlinkAddress: string;
  walletAddress: string | null;
};

function formatTokenAmount(
  amount: bigint,
  decimals: number,
  minimumFractionDigits = 2,
  maximumFractionDigits = minimumFractionDigits,
) {
  const formatted = Number(formatUnits(amount, decimals));
  return formatted.toLocaleString('fr-FR', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

async function getWalletBalances(walletAddress: string | null) {
  if (!walletAddress) {
    return {
      walletUsdc: 0n,
      walletEth: 0n,
    };
  }

  const [walletUsdc, walletEth] = await Promise.all([
    publicClient.readContract({
      address: config.usdcToken,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    }),
    publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    }),
  ]);

  return {
    walletUsdc: walletUsdc as bigint,
    walletEth,
  };
}

export async function buildUnlinkClient(params: {
  mnemonic: string;
  wallet: BaseWallet | null;
}) {
  const unlinkBase = {
    engineUrl: config.unlinkEngineUrl,
    apiKey: config.unlinkApiKey,
    account: unlinkAccount.fromMnemonic({
      mnemonic: params.mnemonic,
    }),
  };

  if (!params.wallet) {
    return createUnlink(unlinkBase);
  }

  const walletClient = await dynamicClient.viem.createWalletClient({
    wallet: params.wallet,
    chain: baseSepolia,
  });

  return createUnlink({
    ...unlinkBase,
    evm: unlinkEvm.fromViem({
      walletClient,
      publicClient,
    }),
  });
}

export async function getWalletSnapshot(params: {
  mnemonic: string;
  wallet: BaseWallet | null;
}): Promise<WalletSnapshot> {
  const unlinkClient = await buildUnlinkClient(params);

  await unlinkClient.ensureRegistered();

  const walletAddress = params.wallet?.address ?? null;
  const [unlinkAddress, privateBalances, walletBalances] = await Promise.all([
    unlinkClient.getAddress(),
    unlinkClient.getBalances(),
    getWalletBalances(walletAddress),
  ]);

  const privateUsdcBalance =
    privateBalances.balances.find(
      balance => balance.token.toLowerCase() === config.usdcToken.toLowerCase(),
    )?.amount ?? '0';

  const privateUsdc = BigInt(privateUsdcBalance);

  const holdings: Holding[] = [
    {
      id: 'private-usdc',
      symbol: 'USDC',
      name: 'Rail privé',
      amount: formatTokenAmount(privateUsdc, 6),
      note: 'Actif principal',
      primary: true,
    },
    {
      id: 'wallet-usdc',
      symbol: 'USDC',
      name: 'Wallet public',
      amount: formatTokenAmount(walletBalances.walletUsdc, 6),
      note: 'Wallet Dynamic',
    },
    {
      id: 'wallet-eth',
      symbol: 'ETH',
      name: 'Gas réseau',
      amount: formatTokenAmount(walletBalances.walletEth, 18, 4, 4),
      note: 'Wallet Dynamic',
    },
  ].filter(item => item.primary || item.amount !== '0,00' && item.amount !== '0,0000');

  return {
    balances: [
      {
        token: 'USDC',
        amount: privateUsdc.toString(),
      },
    ],
    holdings,
    unlinkAddress,
    walletAddress,
  };
}

export async function depositUsdcToPrivateBalance(params: {
  mnemonic: string;
  wallet: BaseWallet;
  amount: string;
}) {
  const unlinkClient = await buildUnlinkClient({
    mnemonic: params.mnemonic,
    wallet: params.wallet,
  });

  return unlinkClient.deposit({
    token: config.usdcToken,
    amount: params.amount,
  });
}
