import "dotenv/config";
import {
  createUnlink,
  unlinkAccount,
  unlinkEvm,
} from "@unlink-xyz/sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ─── Config ───────────────────────────────────────────────────────────────────

const ENGINE_URL = "https://staging-api.unlink.xyz";

// Token USDC de test Unlink sur Base Sepolia
export const USDC_TOKEN = "0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7";

// ─── Clients viem ─────────────────────────────────────────────────────────────

function buildEvmClients() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
  });

  return { publicClient, walletClient };
}

// ─── Factory Unlink client ────────────────────────────────────────────────────

/**
 * Crée un client Unlink depuis une mnemonic passée dynamiquement.
 * La mnemonic est dérivée côté client (wallet signature → seed → mnemonic)
 * et envoyée avec chaque requête. Le backend ne la stocke jamais.
 */
export function buildUnlinkClient(mnemonic: string) {
  const apiKey = process.env.UNLINK_API_KEY!;
  const { publicClient, walletClient } = buildEvmClients();

  return createUnlink({
    engineUrl: ENGINE_URL,
    apiKey,
    account: unlinkAccount.fromMnemonic({ mnemonic }),
    evm: unlinkEvm.fromViem({ walletClient, publicClient }),
  });
}

// ─── Opérations ───────────────────────────────────────────────────────────────

export async function getBalance(mnemonic: string) {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  return client.getBalances();
}

export async function deposit(mnemonic: string, amount: string, token = USDC_TOKEN) {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  await client.ensureErc20Approval({ token, amount });
  return client.deposit({ token, amount });
}

export async function transfer(
  mnemonic: string,
  recipientUnlinkAddress: string,
  amount: string,
  token = USDC_TOKEN
) {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  const tx = await client.transfer({ recipientAddress: recipientUnlinkAddress, amount, token });
  await client.pollTransactionStatus(tx.txId);
  return tx;
}

export async function withdraw(mnemonic: string, toEvm: string, amount: string, token = USDC_TOKEN) {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  const tx = await client.withdraw({ token, amount, recipientEvmAddress: toEvm });
  await client.pollTransactionStatus(tx.txId);
  return tx;
}

export async function getUnlinkAddress(mnemonic: string): Promise<string> {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  return client.getAddress();
}
