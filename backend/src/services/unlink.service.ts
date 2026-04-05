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

// USDC canonique sur Base Sepolia (override possible via env USDC_TOKEN).
export const USDC_TOKEN =
  (process.env.USDC_TOKEN || "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;

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

async function waitForProcessedTx(
  client: ReturnType<typeof buildUnlinkClient>,
  txId: string,
  operation: string,
  timeoutMs = 120000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await client.pollTransactionStatus(txId, {
      intervalMs: 2000,
      timeoutMs: 30000,
    });
    console.log(`[Unlink] ${operation} tx ${txId} -> ${status.status}`);

    if (status.status === "processed" || status.status === "relayed") {
      return status;
    }

    if (status.status === "failed") {
      throw new Error(`${operation} failed on Unlink`);
    }

    // "relayed" can still be pending settlement in the engine.
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`${operation} timeout on Unlink`);
}

function extractTokenAmount(
  balances: Awaited<ReturnType<ReturnType<typeof buildUnlinkClient>["getBalances"]>>,
  token: string,
) {
  const row = balances.balances.find(
    balance => balance.token.toLowerCase() === token.toLowerCase(),
  );
  return BigInt(row?.amount ?? "0");
}

async function waitForTokenBalanceAtLeast(
  client: ReturnType<typeof buildUnlinkClient>,
  token: string,
  minimum: bigint,
  operation: string,
  timeoutMs = 120000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const balances = await client.getBalances({ token });
    const amount = extractTokenAmount(balances, token);
    if (amount >= minimum) {
      console.log(
        `[Unlink] ${operation} balance ready token=${token} amount=${amount.toString()}`,
      );
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`${operation} balance timeout on Unlink`);
}

// ─── Opérations ───────────────────────────────────────────────────────────────

export async function getBalance(mnemonic: string) {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  return client.getBalances();
}

export async function deposit(mnemonic: string, amount: string, token = USDC_TOKEN) {
  const client = buildUnlinkClient(mnemonic);
  console.log(`[Unlink] deposit start amount=${amount} token=${token}`);
  await client.ensureRegistered();
  console.log("[Unlink] deposit registered");
  const balancesBefore = await client.getBalances({ token });
  const beforeAmount = extractTokenAmount(balancesBefore, token);
  const approval = await client.ensureErc20Approval({ token, amount });
  console.log(`[Unlink] approval status=${(approval as any)?.status ?? "unknown"}`);
  const tx = await client.deposit({ token, amount });
  console.log(`[Unlink] deposit txId=${tx.txId}`);
  await waitForProcessedTx(client, tx.txId, "deposit");
  await waitForTokenBalanceAtLeast(
    client,
    token,
    beforeAmount + BigInt(amount),
    "deposit",
  );
  console.log(`[Unlink] deposit processed txId=${tx.txId}`);
  return tx;
}

export async function transfer(
  mnemonic: string,
  recipientUnlinkAddress: string,
  amount: string,
  token = USDC_TOKEN
) {
  const client = buildUnlinkClient(mnemonic);
  console.log(`[Unlink] transfer start amount=${amount} token=${token}`);
  await client.ensureRegistered();
  console.log("[Unlink] transfer registered");
  const tx = await client.transfer({ recipientAddress: recipientUnlinkAddress, amount, token });
  console.log(`[Unlink] transfer txId=${tx.txId}`);
  await waitForProcessedTx(client, tx.txId, "transfer");
  console.log(`[Unlink] transfer processed txId=${tx.txId}`);
  return tx;
}

export async function withdraw(mnemonic: string, toEvm: string, amount: string, token = USDC_TOKEN) {
  const client = buildUnlinkClient(mnemonic);
  console.log(`[Unlink] withdraw start amount=${amount} token=${token} to=${toEvm}`);
  await client.ensureRegistered();
  console.log("[Unlink] withdraw registered");
  const tx = await client.withdraw({ token, amount, recipientEvmAddress: toEvm });
  console.log(`[Unlink] withdraw txId=${tx.txId}`);
  await waitForProcessedTx(client, tx.txId, "withdraw");
  console.log(`[Unlink] withdraw processed txId=${tx.txId}`);
  return tx;
}

export async function getUnlinkAddress(mnemonic: string): Promise<string> {
  const client = buildUnlinkClient(mnemonic);
  await client.ensureRegistered();
  return client.getAddress();
}
