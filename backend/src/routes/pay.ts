import { Router, Request, Response } from "express";
import { transfer } from "../services/unlink.service.js";
import { markPaidOnChain, getRequest } from "../services/contract.service.js";
import { keccak256, toHex } from "viem";

const router = Router();

/**
 * POST /api/pay
 * Exécute un paiement ZK via Unlink et marque la request comme payée on-chain.
 *
 * Body:
 *   mnemonic    — identité Unlink de l'acheteur (dérivée côté client, jamais stockée)
 *   requestId   — bytes32 hex de la demande de paiement
 *   amount      — montant en string (ex: "10000000" pour 10 USDC 6 decimals)
 *
 * Le backend déchiffre l'adresse Unlink destinataire depuis le contrat (unlinkAddressHash)
 * Note: pour le mode hackathon, l'adresse Unlink est envoyée en clair dans la request
 */
router.post("/pay", async (req: Request, res: Response) => {
  const { mnemonic, requestId, recipientUnlinkAddress, amount } = req.body;

  if (!mnemonic || !requestId || !recipientUnlinkAddress || !amount) {
    res.status(400).json({ error: "Champs manquants: mnemonic, requestId, recipientUnlinkAddress, amount" });
    return;
  }

  try {
    // 1. Vérifie la request on-chain
    const request = await getRequest(requestId as `0x${string}`);
    if (request.status !== 0) {
      res.status(409).json({ error: "Request déjà payée, expirée ou annulée" });
      return;
    }

    // 2. Transfert Unlink ZK
    const tx = await transfer(mnemonic, recipientUnlinkAddress, amount);

    // 3. Marque payée on-chain
    await markPaidOnChain(requestId as `0x${string}`, BigInt(amount));

    res.json({ txId: tx.txId, status: tx.status });
  } catch (err: any) {
    console.error("[/api/pay]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

export default router;
