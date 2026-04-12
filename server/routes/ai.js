import { Router } from "express";
import axios from "axios";
import { protect } from "../middleware/auth.js";
import { getLivePrices } from "../utils/priceStore.js";

const router = Router();
const ML = process.env.ML_SERVICE_URL || "http://localhost:8000";

// POST /api/ai/predict  { ticker, prices: [float] }
router.post("/predict", protect, async (req, res) => {
  try {
    const { ticker, prices } = req.body;
    if (!prices || prices.length < 10)
      return res.status(400).json({ error: "Need at least 10 price points" });

    const { data } = await axios.post(`${ML}/predict`, { ticker, prices });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "ML service unavailable", detail: err.message });
  }
});

// POST /api/ai/sentiment  { ticker }
router.post("/sentiment", protect, async (req, res) => {
  try {
    const { data } = await axios.post(`${ML}/sentiment`, req.body);
    res.json(data);
  } catch {
    res.json({ sentiment: "neutral", confidence: 0.5 });
  }
});

// POST /api/ai/risk  { ticker, prices }
router.post("/risk", protect, async (req, res) => {
  try {
    const { data } = await axios.post(`${ML}/risk`, req.body);
    res.json(data);
  } catch {
    res.json({ score: 50, label: "Moderate" });
  }
});

// GET /api/ai/suggestions — suggests stocks based on watchlist + holdings
router.get("/suggestions", protect, async (req, res) => {
  try {
    const stocks = getLivePrices();
    const { data } = await axios.post(`${ML}/suggestions`, {
      watchlist: req.user.watchlist,
      stocks: stocks.map(s => ({ ticker: s.ticker, price: s.price, change: s.change })),
    });
    res.json(data);
  } catch {
    res.json({ suggestions: [] });
  }
});

export default router;
