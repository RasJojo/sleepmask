import { Router, Request, Response } from "express";
import { createWalletClient, http, keccak256, toHex, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { createPaymentRequestOnChain } from "../services/contract.service.js";
import { USDC_TOKEN } from "../services/unlink.service.js";

const router = Router();

/**
 * POST /api/receive/create
 * Crée une demande de paiement on-chain.
 *
 * Body:
 *   unlinkAddress  — adresse Unlink du destinataire (unlink1...)
 *                    Le backend hash l'adresse avant de l'envoyer on-chain.
 *   amount         — montant en string (0 = libre)
 *   ttlSeconds     — durée de validité (0 = pas d'expiry)
 *   token          — adresse token (défaut USDC)
 *
 * Retourne: requestId (bytes32), qrData (string pour le QR code)
 */
router.post("/receive/create", async (req: Request, res: Response) => {
  const { unlinkAddress, amount = "0", ttlSeconds = "3600", token = USDC_TOKEN } = req.body;

  if (!unlinkAddress) {
    res.status(400).json({ error: "unlinkAddress requis" });
    return;
  }

  try {
    // Génère un requestId unique
    const nonce = Date.now().toString();
    const requestId = keccak256(
      encodePacked(["string", "string"], [unlinkAddress, nonce])
    );

    // Hash l'adresse Unlink — protège la vie privée on-chain
    const unlinkAddressHash = keccak256(toHex(unlinkAddress));

    // Crée la request on-chain
    const txHash = await createPaymentRequestOnChain({
      requestId,
      unlinkAddressHash,
      token: token as `0x${string}`,
      amount: BigInt(amount),
      ttlSeconds: BigInt(ttlSeconds),
    });

    // QR data : format compatible wallets standard + Sleepay
    const qrData = `sleepay://pay?requestId=${requestId}&amount=${amount}&token=${token}`;

    res.json({ requestId, txHash, qrData });
  } catch (err: any) {
    console.error("[/api/receive/create]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

/**
 * GET /api/receive/status/:requestId
 * Vérifie le statut d'une request on-chain.
 */
router.get("/receive/status/:requestId", async (req: Request, res: Response) => {
  const { requestId } = req.params;

  try {
    const { isPaid } = await import("../services/contract.service.js");
    const paid = await isPaid(requestId as `0x${string}`);
    res.json({ requestId, paid });
  } catch (err: any) {
    console.error("[/api/receive/status]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

export default router;
