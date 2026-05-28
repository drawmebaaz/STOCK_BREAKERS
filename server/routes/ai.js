import { Router } from "express";
import axios from "axios";
import { protect } from "../middleware/auth.js";
import { env } from "../config/env.js";
import {
  predictionSchema,
  riskSchema,
  sentimentSchema,
  validateBody,
} from "../middleware/validation.js";
import { getLivePrices } from "../utils/priceStore.js";

const router = Router();
const ml = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 7000,
  maxContentLength: 1024 * 1024,
});

router.post("/predict", protect, validateBody(predictionSchema), async (req, res) => {
  try {
    const { data } = await ml.post("/predict", req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "ML service unavailable", detail: err.message });
  }
});

router.post("/sentiment", protect, validateBody(sentimentSchema), async (req, res) => {
  try {
    const { data } = await ml.post("/sentiment", req.body);
    res.json(data);
  } catch {
    res.json({ sentiment: "neutral", confidence: 0.5, headlines: [] });
  }
});

router.post("/risk", protect, validateBody(riskSchema), async (req, res) => {
  try {
    const { data } = await ml.post("/risk", req.body);
    res.json(data);
  } catch {
    res.json({ score: 50, label: "Moderate", color: "amber" });
  }
});

router.get("/suggestions", protect, async (req, res) => {
  try {
    const stocks = getLivePrices();
    const { data } = await ml.post("/suggestions", {
      watchlist: req.user.watchlist || [],
      stocks: stocks.map((s) => ({ ticker: s.ticker, price: s.price, change: s.change })),
    });
    res.json(data);
  } catch {
    res.json({ trending_up: [], dip_buys: [] });
  }
});

export default router;
