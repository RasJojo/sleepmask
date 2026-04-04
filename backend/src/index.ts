import "dotenv/config";
import express from "express";
import cors from "cors";

import payRouter from "./routes/pay.js";
import balanceRouter from "./routes/balance.js";
import depositRouter from "./routes/deposit.js";
import receiveRouter from "./routes/receive.js";

const app = express();
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Sleepay backend running on http://localhost:${PORT}`);
});

export default app;
