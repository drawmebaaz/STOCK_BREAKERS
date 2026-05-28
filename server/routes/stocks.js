import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { tickerSchema } from "../middleware/validation.js";
import { getLivePrices } from "../utils/priceStore.js";

const router = Router();

router.get("/", protect, (req, res) => {
  res.json({ stocks: getLivePrices() });
});

router.get("/:ticker", protect, (req, res) => {
  const result = tickerSchema.safeParse(req.params.ticker);
  if (!result.success) return res.status(400).json({ error: "Invalid ticker" });

  const stock = getLivePrices().find((s) => s.ticker === result.data);
  if (!stock) return res.status(404).json({ error: "Stock not found" });
  res.json({ stock });
});

export default router;
