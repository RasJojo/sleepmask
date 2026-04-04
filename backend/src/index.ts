import "dotenv/config";
import express from "express";
import cors from "cors";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

import payRouter from "./routes/pay.js";
import balanceRouter from "./routes/balance.js";
import depositRouter from "./routes/deposit.js";
import receiveRouter, { receiveStore } from "./routes/receive.js";
import {
  notifyReceivedOnChain,
  markPaidOnChain,
  watchFundsReceived,
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
  "function transfer(address to, uint256 amount) returns (bool)",
]);

function startCas3Watcher() {
  const rpcUrl      = process.env.RPC_URL || "https://sepolia.base.org";
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
        for (const [requestId, { unlinkAddress, token }] of receiveStore.entries()) {
          const oneshotAccount = deriveOneshotAccount(requestId);
          if (oneshotAccount.address.toLowerCase() !== to.toLowerCase()) continue;

          console.log(`[Cas 3] Fonds détectés au one-shot ${to} pour ${requestId}`);

          try {
            // Notifie le contrat (vérifie le solde on-chain)
            await notifyReceivedOnChain(requestId as `0x${string}`, value);

            // Sweep : one-shot → relayer EVM
            const oneshotWallet = createWalletClient({
              account:   oneshotAccount,
              chain:     baseSepolia,
              transport: http(rpcUrl),
            });
            await oneshotWallet.writeContract({
              address:      usdcAddress,
              abi:          ERC20_TRANSFER_ABI,
              functionName: "transfer",
              args:         [oneshotAccount.address, value], // sera remplacé par l'adresse relayer
            });

            // Deposit dans Unlink depuis le relayer
            const relayerMnemonic = deriveRelayerMnemonic();
            await deposit(relayerMnemonic, value.toString(), token);

            // Transfer Unlink relayer → Alice
            await transfer(relayerMnemonic, unlinkAddress, value.toString(), token);

            // Marque payé on-chain
            await markPaidOnChain(requestId as `0x${string}`, value);

            // Nettoie le store
            receiveStore.delete(requestId);

            console.log(`[Cas 3] Paiement finalisé pour ${requestId}`);
          } catch (err: any) {
            console.error(`[Cas 3] Erreur pour ${requestId}:`, err?.message || err);
          }
          break;
        }
      }
    },
  });

  return unwatch;
}

// ─── Watcher FundsReceived (event contrat) ────────────────────────────────────
// Redondant avec le watcher ERC20 ci-dessus, mais utile si notifyReceived
// est appelé manuellement par un opérateur externe.

function startFundsReceivedWatcher() {
  return watchFundsReceived(async ({ requestId, oneshotAddress, amount }) => {
    console.log(`[FundsReceived] ${requestId} — ${amount} @ ${oneshotAddress}`);
    const entry = receiveStore.get(requestId);
    if (!entry) return; // déjà traité par le watcher ERC20

    try {
      const relayerMnemonic = deriveRelayerMnemonic();
      await deposit(relayerMnemonic, amount.toString(), entry.token);
      await transfer(relayerMnemonic, entry.unlinkAddress, amount.toString(), entry.token);
      await markPaidOnChain(requestId, amount);
      receiveStore.delete(requestId);
    } catch (err: any) {
      console.error(`[FundsReceived] Erreur:`, err?.message || err);
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Sleepay backend running on http://localhost:${PORT}`);

  if (process.env.CONTRACT_ADDRESS) {
    startCas3Watcher();
    startFundsReceivedWatcher();
    console.log("Watchers Cas 3 démarrés");
  } else {
    console.warn("CONTRACT_ADDRESS manquant — watchers désactivés");
  }
});

export default app;
