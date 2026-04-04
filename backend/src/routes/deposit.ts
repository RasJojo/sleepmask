import { Router, Request, Response } from "express";
import { deposit, USDC_TOKEN } from "../services/unlink.service.js";

const router = Router();

/**
 * POST /api/deposit
 * Dépose des tokens depuis le wallet EVM vers la pool Unlink.
 * Body: { mnemonic: string, amount: string, token?: string }
 */
router.post("/deposit", async (req: Request, res: Response) => {
  const { mnemonic, amount, token = USDC_TOKEN } = req.body;

  if (!mnemonic || !amount) {
    res.status(400).json({ error: "mnemonic et amount requis" });
    return;
  }

  try {
    const tx = await deposit(mnemonic, amount, token);
    res.json({ txId: tx.txId, status: tx.status });
  } catch (err: any) {
    console.error("[/api/deposit]", err?.message || err);
    res.status(500).json({ error: err?.message || "Erreur inconnue" });
  }
});

export default router;
