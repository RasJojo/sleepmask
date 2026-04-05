import { Router, Request, Response } from "express";
import { createPublicClient, http, keccak256, toHex, encodePacked } from "viem";
import { baseSepolia } from "viem/chains";
import {
  createPaymentRequestOnChain,
  registerOneShotOnChain,
  getRequest,
  isPaid,
} from "../services/contract.service.js";
import { deriveOneshotAccount } from "../services/burner.service.js";
import { USDC_TOKEN } from "../services/unlink.service.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function waitForTx(hash: `0x${string}`) {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
  });
  return client.waitForTransactionReceipt({ hash });
}

async function waitForRequestAvailability(
  requestId: `0x${string}`,
  predicate?: (request: Awaited<ReturnType<typeof getRequest>>) => boolean,
  timeoutMs = 20000,
  intervalMs = 1500,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const request = await getRequest(requestId);

    if (request.creator !== ZERO_ADDRESS && (!predicate || predicate(request))) {
      return request;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timeout de synchronisation RPC sur la request");
}

const router = Router();

// ─── Store in-memory : requestId → unlinkAddress d'Alice ─────────────────────
// Utilisé pour le Cas 3 : quand les fonds arrivent au one-shot, le backend
// sait vers quelle adresse Unlink sweeper.
// Perdu au redémarrage — acceptable pour le hackathon.
export const receiveStore = new Map<
  string,
  { unlinkAddress: string; token: `0x${string}` }
>();

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
  const {
    unlinkAddress,
    amount = "0",
    ttlSeconds = "3600",
    token: tokenRaw = USDC_TOKEN,
  } = req.body;

  if (!unlinkAddress) {
    res.status(400).json({ error: "unlinkAddress requis" });
    return;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(String(tokenRaw))) {
    res.status(400).json({ error: "token invalide" });
    return;
  }

  const token = tokenRaw as `0x${string}`;

  try {
    // Génère un requestId unique
    const nonce     = Date.now().toString();
    const requestId = keccak256(encodePacked(["string", "string"], [unlinkAddress, nonce]));

    // Hash l'adresse Unlink — jamais révélée on-chain
    const unlinkAddressHash = keccak256(toHex(unlinkAddress));

    // Crée la request on-chain et attend la confirmation avant de continuer
    const createTxHash = await createPaymentRequestOnChain({
      requestId,
      unlinkAddressHash,
      token,
      amount:     BigInt(amount),
      ttlSeconds: BigInt(ttlSeconds),
    });
    await waitForTx(createTxHash);
    await waitForRequestAvailability(requestId);

    // Dérive l'adresse EVM one-shot pour le Cas 3 (wallet classique → Sleepmask)
    // Seul le backend peut la reconstruire (dérivée de EVM_PRIVATE_KEY + requestId)
    const oneshotAccount = deriveOneshotAccount(requestId);
    const oneshotAddress = oneshotAccount.address;

    // Enregistre le one-shot on-chain → émet OneShotRegistered
    const registerTxHash = await registerOneShotOnChain(requestId, oneshotAddress);
    await waitForTx(registerTxHash);
    await waitForRequestAvailability(
      requestId,
      request => request.burnerAddress !== ZERO_ADDRESS,
    );

    // Stocke le mapping requestId → unlinkAddress pour le sweep Cas 3
    receiveStore.set(requestId, { unlinkAddress, token });

    // QR Sleepmask : requestId + adresse Unlink d'Alice pour les utilisateurs Sleepmask
    // L'adresse Unlink est partagée uniquement avec le payeur via le QR, jamais stockée
    const qrSleepmask = `sleepmask://pay?requestId=${requestId}&amount=${amount}&token=${token}&recipient=${encodeURIComponent(unlinkAddress)}`;

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
