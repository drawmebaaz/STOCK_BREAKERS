import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { tickerSchema } from "../middleware/validation.js";
import { getMarketHealth } from "../utils/marketMetrics.js";
import { getCandles, getIndex, getIndexes, getMarketEvents, getMarketStatus, getQuote } from "../utils/priceStore.js";

const router = Router();

router.get("/status", protect, (_req, res) => {
  res.json({ market: getMarketStatus() });
});

router.get("/candles/:ticker", protect, (req, res) => {
  const result = tickerSchema.safeParse(req.params.ticker);
  if (!result.success) return res.status(400).json({ error: "Invalid ticker" });
  const limitByRange = { "1D": 120, "1W": 240, "1M": 500 };
  const limit = req.query.limit || limitByRange[String(req.query.range || "1D").toUpperCase()] || 120;
  const candles = getCandles(result.data, limit);
  const quote = getQuote(result.data);
  if (!candles || !quote) return res.status(404).json({ error: "Market data not found" });
  res.json({
    ticker: result.data,
    range: req.query.range || "1D",
    interval: req.query.interval || "5m",
    candles,
    quote,
    market: getMarketStatus(),
    simulationNotice: "Uses simulated in-app market data for educational practice.",
  });
});

router.get("/events", protect, (req, res) => {
  res.json({
    events: getMarketEvents({
      ticker: req.query.ticker ? String(req.query.ticker).toUpperCase() : undefined,
      sector: req.query.sector,
    }),
    simulationNotice: "These are generated simulation events, not real news.",
  });
});

router.get("/indexes", protect, (_req, res) => {
  res.json({ indexes: getIndexes(), simulationNotice: "Simulated benchmark indexes for practice comparison." });
});

router.get("/indexes/:symbol", protect, (req, res) => {
  const index = getIndex(req.params.symbol);
  if (!index) return res.status(404).json({ error: "Benchmark index not found" });
  res.json({ index, simulationNotice: "Simulated benchmark index for practice comparison." });
});

router.get("/health", protect, (_req, res) => {
  res.json({ ...getMarketHealth(), market: getMarketStatus() });
});

export default router;
