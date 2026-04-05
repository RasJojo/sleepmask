import "dotenv/config";
import express from "express";
import cors from "cors";
import { createPublicClient, http, parseAbi, parseGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import payRouter from "./routes/pay.js";
import balanceRouter from "./routes/balance.js";
import depositRouter from "./routes/deposit.js";
import receiveRouter, { receiveStore } from "./routes/receive.js";
import {
  notifyReceivedOnChain,
  markPaidOnChain,
  watchFundsReceived,
  isPaid,
  getRequest,
  RequestStatus,
} from "./services/contract.service.js";
import {
  deriveOneshotAccount,
  deriveRelayerMnemonic,
} from "./services/burner.service.js";
import { deposit, transfer, USDC_TOKEN } from "./services/unlink.service.js";
import { createWalletClient } from "viem";

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api", payRouter);
app.use("/api", balanceRouter);
app.use("/api", depositRouter);
app.use("/api", receiveRouter);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", network: "base-sepolia" });
});

// ─── Cas 3 : surveillance des one-shot addresses ──────────────────────────────
//
// Quand un wallet classique envoie des USDC à une adresse one-shot :
//   1. Le backend détecte l'arrivée (Transfer ERC20)
//   2. Appelle notifyReceivedOnChain() → vérifie le solde on-chain → émet FundsReceived
//   3. Sweep USDC one-shot → relayer EVM → deposit Unlink → transfer vers Alice
//   4. markPaidOnChain()

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const pendingReceiveNotifications = new Set<string>();
const processingCas3Settlements = new Set<string>();
const MIN_ONESHOT_GAS_WEI = 100_000_000_000_000n; // 0.0001 ETH
const ONESHOT_GAS_TOPUP_WEI = 300_000_000_000_000n; // 0.0003 ETH

function getRpcUrl() {
  return process.env.RPC_URL || "https://sepolia.base.org";
}

function getRelayerAccount() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  return privateKeyToAccount(privateKey);
}

function isNonceSyncError(error: any) {
  const message = String(error?.message || error?.details || "");
  return (
    message.includes("nonce too low") ||
    message.includes("Nonce provided for the transaction") ||
    message.includes("replacement transaction underpriced")
  );
}

async function sweepOneshotToRelayer(requestId: string, amount: bigint) {
  const rpcUrl = getRpcUrl();
  const usdcAddress = (process.env.USDC_TOKEN || USDC_TOKEN) as `0x${string}`;
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const oneshotAccount = deriveOneshotAccount(requestId);
  const relayerAccount = getRelayerAccount();
  const relayerWallet = createWalletClient({
    account: relayerAccount,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // One-shot accounts receive USDC only, so they usually have 0 ETH.
  // Fund a tiny amount for gas before sweeping ERC20 out.
  const oneshotEth = await publicClient.getBalance({
    address: oneshotAccount.address,
  });
  if (oneshotEth < MIN_ONESHOT_GAS_WEI) {
    let topupHash: `0x${string}` | null = null;
    let topupError: any = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nonce = await publicClient.getTransactionCount({
        address: relayerAccount.address,
        blockTag: "pending",
      });

      try {
        topupHash = await relayerWallet.sendTransaction({
          to: oneshotAccount.address,
          value: ONESHOT_GAS_TOPUP_WEI,
          nonce,
        });
        break;
      } catch (error: any) {
        topupError = error;
        if (!isNonceSyncError(error) || attempt === 2) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    if (!topupHash) {
      throw topupError ?? new Error("Top-up one-shot impossible");
    }

    await publicClient.waitForTransactionReceipt({ hash: topupHash });

    const balanceVisibleDeadline = Date.now() + 20000;
    let topupVisible = false;
    while (Date.now() < balanceVisibleDeadline) {
      const refreshedBalance = await publicClient.getBalance({
        address: oneshotAccount.address,
      });
      if (refreshedBalance >= MIN_ONESHOT_GAS_WEI) {
        topupVisible = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!topupVisible) {
      throw new Error("Top-up one-shot non visible côté RPC");
    }
  }

  const oneshotWallet = createWalletClient({
    account: oneshotAccount,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const txHash = await oneshotWallet.writeContract({
    address: usdcAddress,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [relayerAccount.address, amount],
    gas: 120000n,
    maxFeePerGas: parseGwei("0.05"),
    maxPriorityFeePerGas: parseGwei("0.02"),
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

async function finalizeCas3Request(requestId: string, amount: bigint) {
  if (processingCas3Settlements.has(requestId)) {
    return;
  }
  processingCas3Settlements.add(requestId);

  try {
    const entry = receiveStore.get(requestId);
    if (!entry) {
      console.warn(`[Cas 3] Mapping requestId introuvable pour ${requestId}`);
      return;
    }

    const alreadyPaid = await isPaid(requestId as `0x${string}`);
    if (alreadyPaid) {
      receiveStore.delete(requestId);
      pendingReceiveNotifications.delete(requestId);
      return;
    }

    console.log(`[Cas 3] Settlement démarré pour ${requestId} (${amount})`);

    await sweepOneshotToRelayer(requestId, amount);
    console.log(`[Cas 3] Sweep terminé pour ${requestId}`);

    const relayerMnemonic = deriveRelayerMnemonic();
    await deposit(relayerMnemonic, amount.toString(), entry.token);
    console.log(`[Cas 3] Deposit Unlink terminé pour ${requestId}`);
    await transfer(relayerMnemonic, entry.unlinkAddress, amount.toString(), entry.token);
    console.log(`[Cas 3] Transfer Unlink terminé pour ${requestId}`);
    await markPaidOnChain(requestId as `0x${string}`, amount);
    console.log(`[Cas 3] markPaid on-chain terminé pour ${requestId}`);

    receiveStore.delete(requestId);
    pendingReceiveNotifications.delete(requestId);
    console.log(`[Cas 3] Settlement terminé pour ${requestId}`);
  } catch (err: any) {
    console.error(`[Cas 3] Settlement erreur pour ${requestId}:`, err?.message || err);
  } finally {
    processingCas3Settlements.delete(requestId);
  }
}

function startCas3Watcher() {
  const rpcUrl      = getRpcUrl();
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const usdcAddress  = (process.env.USDC_TOKEN || USDC_TOKEN) as `0x${string}`;

  // Écoute les Transfer ERC20 USDC → filtre les adresses one-shot connues
  const unwatch = publicClient.watchContractEvent({
    address:   usdcAddress,
    abi:       ERC20_TRANSFER_ABI,
    eventName: "Transfer",
    onLogs: async (logs) => {
      for (const log of logs) {
        const { to, value } = log.args as { from: string; to: string; value: bigint };
        if (!to || !value) continue;

        // Cherche si cette adresse est un one-shot connu
        for (const [requestId] of receiveStore.entries()) {
          const oneshotAccount = deriveOneshotAccount(requestId);
          if (oneshotAccount.address.toLowerCase() !== to.toLowerCase()) continue;

          console.log(`[Cas 3] Fonds détectés au one-shot ${to} pour ${requestId}`);

          if (pendingReceiveNotifications.has(requestId)) {
            break;
          }

          try {
            pendingReceiveNotifications.add(requestId);

            // Notifie le contrat puis finalise directement le settlement.
            const notifyHash = await notifyReceivedOnChain(requestId as `0x${string}`, value);
            await publicClient.waitForTransactionReceipt({ hash: notifyHash });
            await finalizeCas3Request(requestId, value);
          } catch (err: any) {
            pendingReceiveNotifications.delete(requestId);
            console.error(`[Cas 3] Erreur pour ${requestId}:`, err?.message || err);
          }
          break;
        }
      }
    },
  });

  return unwatch;
}

function startCas3Poller() {
  const rpcUrl = getRpcUrl();
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  let running = false;
  const interval = setInterval(() => {
    if (running) return;
    running = true;

    (async () => {
      for (const [requestId, entry] of receiveStore.entries()) {
        if (
          pendingReceiveNotifications.has(requestId) ||
          processingCas3Settlements.has(requestId)
        ) {
          continue;
        }

        try {
          const request = await getRequest(requestId as `0x${string}`);
          if (request.status === RequestStatus.Paid) {
            receiveStore.delete(requestId);
            pendingReceiveNotifications.delete(requestId);
            continue;
          }

          if (request.status !== RequestStatus.BurnerReady) {
            continue;
          }

          const oneshotAddress = request.burnerAddress;
          if (!oneshotAddress || oneshotAddress === "0x0000000000000000000000000000000000000000") {
            continue;
          }

          const oneshotBalance = (await publicClient.readContract({
            address: entry.token,
            abi: ERC20_TRANSFER_ABI,
            functionName: "balanceOf",
            args: [oneshotAddress],
          })) as bigint;

          if (oneshotBalance <= 0n) {
            continue;
          }

          console.log(
            `[Cas 3 Poller] Fonds détectés au one-shot ${oneshotAddress} pour ${requestId}`
          );

          pendingReceiveNotifications.add(requestId);
          try {
            const notifyHash = await notifyReceivedOnChain(
              requestId as `0x${string}`,
              oneshotBalance
            );
            await publicClient.waitForTransactionReceipt({ hash: notifyHash });
            await finalizeCas3Request(requestId, oneshotBalance);
          } catch (err: any) {
            pendingReceiveNotifications.delete(requestId);
            console.error(
              `[Cas 3 Poller] Erreur pour ${requestId}:`,
              err?.message || err
            );
          }
        } catch (err: any) {
          console.error(
            `[Cas 3 Poller] Lecture erreur pour ${requestId}:`,
            err?.message || err
          );
        }
      }
    })()
      .catch((err: any) => {
        console.error("[Cas 3 Poller] Erreur inattendue:", err?.message || err);
      })
      .finally(() => {
        running = false;
      });
  }, 8000);

  return () => clearInterval(interval);
}

// ─── Watcher FundsReceived (event contrat) ────────────────────────────────────
// Redondant avec le watcher ERC20 ci-dessus, mais utile si notifyReceived
// est appelé manuellement par un opérateur externe.

function startFundsReceivedWatcher() {
  return watchFundsReceived(async ({ requestId, oneshotAddress, amount }) => {
    console.log(`[FundsReceived] ${requestId} — ${amount} @ ${oneshotAddress}`);
    await finalizeCas3Request(requestId, amount);
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Sleepmask backend running on http://localhost:${PORT}`);

  if (process.env.CONTRACT_ADDRESS) {
    startCas3Watcher();
    startCas3Poller();
    console.log("Watchers/Poller Cas 3 démarrés");
  } else {
    console.warn("CONTRACT_ADDRESS manquant — watchers désactivés");
  }
});

export default app;
