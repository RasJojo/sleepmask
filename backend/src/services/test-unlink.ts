/**
 * ÉTAPE 1 — Test du flow Unlink SDK complet
 *
 * Flow : approve → deposit → transfer (self) → withdraw
 *
 * Avant de lancer ce script, il faut avoir des tokens de test dans le wallet EVM.
 * → Aller sur https://hackaton-apikey.vercel.app et utiliser le faucet pour recevoir
 *   des tokens de test sur Base Sepolia à l'adresse de EVM_PRIVATE_KEY.
 *   Token de test : 0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7
 *
 * Usage :
 *   cd backend
 *   cp ../.env.example ../.env  # puis remplir les valeurs
 *   npm run test:unlink
 *
 * Prérequis dans .env :
 *   UNLINK_API_KEY   — depuis https://hackaton-apikey.vercel.app
 *   EVM_PRIVATE_KEY  — clé privée 0x... avec ETH sur Base Sepolia (gas) ET des tokens de test
 *   USER_MNEMONIC    — 12 mots BIP39 — générer avec la commande ci-dessous
 *   RPC_URL          — https://sepolia.base.org
 *
 * Générer un mnemonic de test :
 *   node -e "const {generateMnemonic,english}=require('viem/accounts');console.log(generateMnemonic(english))"
 */

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

// ── Config ───────────────────────────────────────────────────────────────────

const UNLINK_ENGINE_URL = "https://staging-api.unlink.xyz";
const TEST_TOKEN = "0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7"; // faucet token Base Sepolia
const TEST_AMOUNT = "1000000000000000000"; // 1 token (18 decimals)

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function log(step: string, data?: unknown) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${step}`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load env
  const apiKey = requireEnv("UNLINK_API_KEY");
  const evmPrivateKey = requireEnv("EVM_PRIVATE_KEY") as `0x${string}`;
  const userMnemonic = requireEnv("USER_MNEMONIC");
  const rpcUrl = requireEnv("RPC_URL");

  log("Config", {
    engineUrl: UNLINK_ENGINE_URL,
    token: TEST_TOKEN,
    amount: TEST_AMOUNT + " (1 token, 18 decimals)",
    rpc: rpcUrl,
  });

  // 2. Build viem clients
  const evmAccount = privateKeyToAccount(evmPrivateKey);
  log("EVM account loaded", { address: evmAccount.address });

  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // 3. Init Unlink
  const unlink = createUnlink({
    engineUrl: UNLINK_ENGINE_URL,
    apiKey,
    account: unlinkAccount.fromMnemonic({ mnemonic: userMnemonic }),
    evm: unlinkEvm.fromViem({ walletClient, publicClient }),
  });

  const unlinkAddress = await unlink.getAddress();
  log("Unlink address", { unlinkAddress });

  // 4. Approve token for Permit2 (one-time per token per wallet)
  log("Step 1/4 — Approving token for Permit2...");
  const approval = await unlink.ensureErc20Approval({
    token: TEST_TOKEN,
    amount: TEST_AMOUNT,
  });
  log("Approval result", approval);

  // 5. Deposit into privacy pool
  log("Step 2/4 — Depositing into Unlink pool...");
  const deposit = await unlink.deposit({
    token: TEST_TOKEN,
    amount: TEST_AMOUNT,
  });
  log("Deposit submitted", { txId: deposit.txId, status: deposit.status });

  const depositConfirmed = await unlink.pollTransactionStatus(deposit.txId);
  log("Deposit confirmed", depositConfirmed);

  // 6. Transfer to self (proves private transfer works — sender/recipient unlinkable)
  log("Step 3/4 — Private transfer to self (proves ZK unlinkability)...");
  const transfer = await unlink.transfer({
    recipientAddress: unlinkAddress,
    token: TEST_TOKEN,
    amount: TEST_AMOUNT,
  });
  log("Transfer submitted", { txId: transfer.txId, status: transfer.status });

  const transferConfirmed = await unlink.pollTransactionStatus(transfer.txId);
  log("Transfer confirmed", transferConfirmed);

  // 7. Withdraw back to EVM wallet
  log("Step 4/4 — Withdrawing to EVM wallet...");
  const withdrawal = await unlink.withdraw({
    recipientEvmAddress: evmAccount.address,
    token: TEST_TOKEN,
    amount: TEST_AMOUNT,
  });
  log("Withdrawal submitted", { txId: withdrawal.txId, status: withdrawal.status });

  const withdrawConfirmed = await unlink.pollTransactionStatus(withdrawal.txId);
  log("Withdrawal confirmed", withdrawConfirmed);

  // 8. Final balance check
  const balances = await unlink.getBalances();
  log("Final Unlink balances", balances);

  log("✅ ÉTAPE 1 COMPLÈTE — Unlink flow deposit → transfer → withdraw OK");
  console.log("\nCopie les txId dans PROGRESS.md avant de continuer.\n");
}

main().catch((err) => {
  console.error("\n❌ ÉTAPE 1 ÉCHOUÉE :", err.message ?? err);
  if (err.code) console.error("Code:", err.code);
  if (err.detail) console.error("Detail:", err.detail);
  process.exit(1);
});
