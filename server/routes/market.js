import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { tickerSchema } from "../middleware/validation.js";
import { getCandles, getMarketStatus, getQuote } from "../utils/priceStore.js";

const router = Router();

router.get("/status", protect, (_req, res) => {
  res.json({ market: getMarketStatus() });
});

router.get("/candles/:ticker", protect, (req, res) => {
  const result = tickerSchema.safeParse(req.params.ticker);
  if (!result.success) return res.status(400).json({ error: "Invalid ticker" });
  const candles = getCandles(result.data, req.query.limit || 120);
  const quote = getQuote(result.data);
  if (!candles || !quote) return res.status(404).json({ error: "Market data not found" });
  res.json({
    ticker: result.data,
    candles,
    quote,
    market: getMarketStatus(),
    simulationNotice: "Uses simulated in-app market data for educational practice.",
  });
});

export default router;
