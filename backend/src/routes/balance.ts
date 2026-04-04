import { Router, Request, Response } from "express";
import { getBalance, getUnlinkAddress } from "../services/unlink.service.js";

const router = Router();

/**
 * POST /api/balance
 * Retourne le solde Unlink de l'utilisateur.
 * Body: { mnemonic: string }
 */
router.post("/balance", async (req: Request, res: Response) => {
  const { mnemonic } = req.body;

  if (!mnemonic) {
    res.status(400).json({ error: "mnemonic requis" });
    return;
  }

  try {
    const [balances, unlinkAddress] = await Promise.all([
      getBalance(mnemonic),
      getUnlinkAddress(mnemonic),
    ]);

    res.json({ balances, unlinkAddress });
  } catch (err: any) {
    console.error("[/api/balance]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

export default router;
