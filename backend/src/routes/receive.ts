import { Router, Request, Response } from "express";
import { keccak256, toHex, encodePacked } from "viem";
import { createPaymentRequestOnChain, registerOneShotOnChain, isPaid } from "../services/contract.service.js";
import { deriveOneshotAccount } from "../services/burner.service.js";
import { USDC_TOKEN } from "../services/unlink.service.js";

const router = Router();

// ─── Store in-memory : requestId → unlinkAddress d'Alice ─────────────────────
// Utilisé pour le Cas 3 : quand les fonds arrivent au one-shot, le backend
// sait vers quelle adresse Unlink sweeper.
// Perdu au redémarrage — acceptable pour le hackathon.
export const receiveStore = new Map<string, { unlinkAddress: string; token: string }>();

// ─── POST /api/receive/create ─────────────────────────────────────────────────

/**
 * Crée une demande de paiement.
 * Gère les deux modes en parallèle :
 *   - Mode Sleepmask : requestId pour payer via /api/pay (Cas 1)
 *   - Mode classique : oneshotAddress EVM pour payer directement en USDC (Cas 3)
 *
 * Body:
 *   unlinkAddress  — adresse Unlink d'Alice (hashée avant d'aller on-chain)
 *   amount         — montant attendu (0 = libre)
 *   ttlSeconds     — durée de validité (défaut 3600s)
 *   token          — token ERC20 (défaut USDC)
 */
router.post("/receive/create", async (req: Request, res: Response) => {
  const { unlinkAddress, amount = "0", ttlSeconds = "3600", token = USDC_TOKEN } = req.body;

  if (!unlinkAddress) {
    res.status(400).json({ error: "unlinkAddress requis" });
    return;
  }

  try {
    // Génère un requestId unique
    const nonce     = Date.now().toString();
    const requestId = keccak256(encodePacked(["string", "string"], [unlinkAddress, nonce]));

    // Hash l'adresse Unlink — jamais révélée on-chain
    const unlinkAddressHash = keccak256(toHex(unlinkAddress));

    // Crée la request on-chain
    await createPaymentRequestOnChain({
      requestId,
      unlinkAddressHash,
      token:      token as `0x${string}`,
      amount:     BigInt(amount),
      ttlSeconds: BigInt(ttlSeconds),
    });

    // Dérive l'adresse EVM one-shot pour le Cas 3 (wallet classique → Sleepmask)
    // Seul le backend peut la reconstruire (dérivée de EVM_PRIVATE_KEY + requestId)
    const oneshotAccount = deriveOneshotAccount(requestId);
    const oneshotAddress = oneshotAccount.address;

    // Enregistre le one-shot on-chain → émet OneShotRegistered
    await registerOneShotOnChain(requestId, oneshotAddress);

    // Stocke le mapping requestId → unlinkAddress pour le sweep Cas 3
    receiveStore.set(requestId, { unlinkAddress, token });

    // QR Sleepmask : requestId pour les utilisateurs Sleepmask
    const qrSleepmask = `sleepay://pay?requestId=${requestId}&amount=${amount}&token=${token}`;

    // QR classique : adresse EVM one-shot pour les wallets classiques (MetaMask, etc.)
    const qrClassic = `ethereum:${oneshotAddress}?value=0&erc20=${token}&uint256=${amount}`;

    res.json({
      requestId,
      oneshotAddress,
      qrSleepmask,  // scanné par un utilisateur Sleepmask → flow ZK two-burner
      qrClassic,    // scanné par un wallet classique → envoie USDC au one-shot
    });
  } catch (err: any) {
    console.error("[/api/receive/create]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

// ─── GET /api/receive/status/:requestId ───────────────────────────────────────

router.get("/receive/status/:requestId", async (req: Request, res: Response) => {
  const { requestId } = req.params;
  try {
    const paid = await isPaid(requestId as `0x${string}`);
    res.json({ requestId, paid });
  } catch (err: any) {
    console.error("[/api/receive/status]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

export default router;
