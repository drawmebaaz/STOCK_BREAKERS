import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getLivePrices } from "../utils/priceStore.js";

const router = Router();

router.get("/", protect, (req, res) => {
  res.json({ stocks: getLivePrices() });
});

router.get("/:ticker", protect, (req, res) => {
  const stock = getLivePrices().find(s => s.ticker === req.params.ticker.toUpperCase());
  if (!stock) return res.status(404).json({ error: "Stock not found" });
  res.json({ stock });
});

export default router;
