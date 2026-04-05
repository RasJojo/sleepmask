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
  privateUsdcRaw: string;
  walletUsdcRaw: string;
};

// ── Singleton Unlink client ─────────────────────────────────────────────────
// The Permit2NonceManager is deeply stateful — it holds an in-memory cache of
// allocated nonces. Creating a new instance for each deposit resets this cache
// and causes "already used" errors when the engine tries to relay the tx.
// One instance per (mnemonic + walletId + walletAddress) tuple, recreated on
// wallet reconnection or logout.

let _unlinkClient: ReturnType<typeof createUnlink> | null = null;
let _unlinkClientKey = '';

export function resetUnlinkClient() {
  _unlinkClient = null;
  _unlinkClientKey = '';
}

async function getOrCreateUnlinkClient(params: {
  mnemonic: string;
  wallet: BaseWallet | null;
}) {
  const key = [
    params.mnemonic,
    params.wallet?.id ?? 'none',
    params.wallet?.address ?? 'none',
  ].join(':');

  if (_unlinkClient && _unlinkClientKey === key) {
    return _unlinkClient;
  }

  const unlinkBase = {
    engineUrl: config.unlinkEngineUrl,
    apiKey: config.unlinkApiKey,
    account: unlinkAccount.fromMnemonic({ mnemonic: params.mnemonic }),
  };

  let client: ReturnType<typeof createUnlink>;

  if (!params.wallet) {
    client = createUnlink(unlinkBase);
  } else {
    const walletClient = await dynamicClient.viem.createWalletClient({
      wallet: params.wallet,
      chain: baseSepolia,
    });

    client = createUnlink({
      ...unlinkBase,
      evm: unlinkEvm.fromViem({
        walletClient,
        publicClient,
      }),
    });
  }

  _unlinkClient = client;
  _unlinkClientKey = key;
  return client;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
    return { walletUsdc: 0n, walletEth: 0n };
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

// ── Public API ───────────────────────────────────────────────────────────────

export async function getWalletSnapshot(params: {
  mnemonic: string;
  wallet: BaseWallet | null;
}): Promise<WalletSnapshot> {
  const walletAddress = params.wallet?.address ?? null;
  const walletBalancesPromise = getWalletBalances(walletAddress);

  let unlinkAddress = '';
  let privateUsdc = 0n;

  try {
    const unlinkClient = await getOrCreateUnlinkClient(params);
    await unlinkClient.ensureRegistered();

    const [resolvedAddress, privateBalances] = await Promise.all([
      unlinkClient.getAddress(),
      unlinkClient.getBalances(),
    ]);

    unlinkAddress = resolvedAddress;
    const privateUsdcBalanceRaw =
      privateBalances.balances.find(
        balance => balance.token.toLowerCase() === config.usdcToken.toLowerCase(),
      )?.amount ?? '0';
    privateUsdc = BigInt(privateUsdcBalanceRaw);
  } catch (error) {
    console.warn('[Unlink] getWalletSnapshot fallback', error);
  }

  const walletBalances = await walletBalancesPromise;

  const holdings: Holding[] = [
    {
      id: 'wallet-usdc',
      symbol: 'USDC',
      name: 'USDC',
      amount: formatTokenAmount(walletBalances.walletUsdc, 6),
      note: 'Base Sepolia',
      primary: true,
    },
    {
      id: 'wallet-eth',
      symbol: 'ETH',
      name: 'ETH',
      amount: formatTokenAmount(walletBalances.walletEth, 18, 4, 4),
      note: 'Gas réseau',
    },
  ].filter(item => item.primary || item.amount !== '0,0000');

  return {
    balances: [{ token: 'USDC', amount: walletBalances.walletUsdc.toString() }],
    holdings,
    unlinkAddress,
    walletAddress,
    privateUsdcRaw: privateUsdc.toString(),
    walletUsdcRaw: walletBalances.walletUsdc.toString(),
  };
}

export async function resolveUnlinkAddress(params: {
  mnemonic: string;
  wallet: BaseWallet | null;
}) {
  const unlinkClient = await getOrCreateUnlinkClient(params);
  await unlinkClient.ensureRegistered();
  return unlinkClient.getAddress();
}

export async function depositUsdcToPrivateBalance(params: {
  mnemonic: string;
  wallet: BaseWallet;
  amount: string;
  token?: `0x${string}`;
}) {
  // Always ensure MetaMask is on Base Sepolia before depositing
  const tempWalletClient = await dynamicClient.viem.createWalletClient({
    wallet: params.wallet,
    chain: baseSepolia,
  });
  try {
    await tempWalletClient.switchChain({ id: baseSepolia.id });
  } catch (_) {
    // already on correct chain or unsupported
  }

  const unlinkClient = await getOrCreateUnlinkClient(params);

  const tx = await unlinkClient.deposit({
    token: params.token ?? config.usdcToken,
    amount: params.amount,
  });

  if (tx && typeof tx === 'object' && 'txId' in tx && tx.txId) {
    await unlinkClient.pollTransactionStatus(tx.txId as string);
  }

  return tx;
}
