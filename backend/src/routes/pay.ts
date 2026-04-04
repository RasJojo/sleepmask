import { Router, Request, Response } from "express";
import { transfer, withdraw, getUnlinkAddress, USDC_TOKEN } from "../services/unlink.service.js";
import {
  instructPaymentOnChain,
  markPaidOnChain,
  getBurnerAddress,
  getRequest,
} from "../services/contract.service.js";
import { deriveBurnerMnemonic, deriveEphemeralBurnerMnemonic } from "../services/burner.service.js";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const router = Router();

// ─── Helper : attend la confirmation d'une tx ─────────────────────────────────

async function waitForTx(hash: `0x${string}`) {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
  });
  return publicClient.waitForTransactionReceipt({ hash });
}

// ─── POST /api/pay ────────────────────────────────────────────────────────────

/**
 * Cas 1 — Sleepmask → Sleepmask (protection maximale)
 * Body: { mnemonic, requestId, recipientUnlinkAddress, amount, token? }
 *
 * Flow two-burner :
 *   1. instructPaymentOnChain(requestId, amount)          → event PaymentInstructed
 *   2. Récupère burnerAddress depuis le contrat
 *   3. Dérive le mnémonique BurnerA depuis burnerAddress
 *   4. Alice  ──[Unlink ZK]──► BurnerA
 *   5. BurnerA ──[Unlink ZK]──► Bob
 *   6. markPaidOnChain(requestId, amount)
 *
 * On-chain visible : le relayer a instruis un paiement + confirmé. Alice et Bob invisibles.
 */
router.post("/pay", async (req: Request, res: Response) => {
  const {
    mnemonic,
    requestId,
    recipientUnlinkAddress,
    amount,
    token = USDC_TOKEN,
  } = req.body;

  if (!mnemonic || !requestId || !recipientUnlinkAddress || !amount) {
    res.status(400).json({
      error: "Champs requis : mnemonic, requestId, recipientUnlinkAddress, amount",
    });
    return;
  }

  try {
    // 1. Vérifie la request on-chain (doit être Pending = status 0)
    const onchainReq = await getRequest(requestId as `0x${string}`);
    if (onchainReq.status !== 0) {
      res.status(409).json({ error: "Request non disponible (déjà payée, expirée ou annulée)" });
      return;
    }

    // 2. Instruis le paiement on-chain → génère BurnerA (CREATE2) et émet PaymentInstructed
    //    Le relayer appelle le contrat — l'adresse d'Alice ne figure jamais on-chain
    const txHash = await instructPaymentOnChain(requestId as `0x${string}`, BigInt(amount));
    await waitForTx(txHash);

    // 3. Récupère l'adresse BurnerA générée par le contrat
    const burnerAddress = await getBurnerAddress(requestId as `0x${string}`);

    // 4. Dérive le mnémonique Unlink de BurnerA depuis son adresse CREATE2
    //    Déterministe : même input → même mnémonique. Jamais stocké.
    const burnerAMnemonic = deriveBurnerMnemonic(burnerAddress);
    const burnerAUnlinkAddress = await getUnlinkAddress(burnerAMnemonic);

    // 5. Alice ──[Unlink ZK]──► BurnerA
    await transfer(mnemonic, burnerAUnlinkAddress, amount, token);

    // 6. BurnerA ──► Bob
    //    "0x" + 40 chars = adresse EVM → Cas 2 (withdraw)
    //    Sinon → adresse Unlink → Cas 1 (transfer ZK)
    const isEvmRecipient =
      recipientUnlinkAddress.startsWith("0x") && recipientUnlinkAddress.length === 42;

    let txId: string;
    if (isEvmRecipient) {
      const tx = await withdraw(burnerAMnemonic, recipientUnlinkAddress, amount, token);
      txId = tx.txId;
    } else {
      const tx = await transfer(burnerAMnemonic, recipientUnlinkAddress, amount, token);
      txId = tx.txId;
    }

    // 7. Confirme le paiement on-chain
    await markPaidOnChain(requestId as `0x${string}`, BigInt(amount));

    res.json({ success: true, txId, burnerAddress });
  } catch (err: any) {
    console.error("[/api/pay]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

// ─── POST /api/pay/direct ─────────────────────────────────────────────────────

/**
 * Cas 2 simplifié — Sleepmask → wallet classique sans request on-chain.
 * Bob donne juste son adresse EVM. Pas de requestId ni de contrat.
 * Body: { mnemonic, recipientEvmAddress, amount, token? }
 *
 * Flow : Alice ──[Unlink ZK]──► BurnerA ──[withdraw]──► Bob EVM
 */
router.post("/pay/direct", async (req: Request, res: Response) => {
  const { mnemonic, recipientEvmAddress, amount, token = USDC_TOKEN } = req.body;

  if (!mnemonic || !recipientEvmAddress || !amount) {
    res.status(400).json({ error: "Champs requis : mnemonic, recipientEvmAddress, amount" });
    return;
  }

  try {
    const burnerMnemonic = deriveEphemeralBurnerMnemonic(mnemonic.slice(0, 8));
    const burnerUnlinkAddr = await getUnlinkAddress(burnerMnemonic);

    await transfer(mnemonic, burnerUnlinkAddr, amount, token);
    const tx = await withdraw(burnerMnemonic, recipientEvmAddress, amount, token);

    res.json({ success: true, txId: tx.txId });
  } catch (err: any) {
    console.error("[/api/pay/direct]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

export default router;
