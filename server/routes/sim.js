import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { addMarketEvent, resetEvents } from "../utils/eventEngine.js";
import { resetMarketClock } from "../utils/marketClock.js";
import { resetMarketState } from "../utils/marketState.js";
import { getEngineSnapshot, updatePrices } from "../utils/priceStore.js";

const router = Router();

const enabled = () => env.NODE_ENV !== "production" || process.env.SIM_CONTROLS_ENABLED === "true";

router.use(protect);
router.use((req, res, next) => {
  if (!enabled()) return res.status(404).json({ error: "Simulation controls are disabled" });
  next();
});

const shockSchema = z.object({
  scope: z.enum(["MARKET", "SECTOR", "TICKER"]).default("MARKET"),
  ticker: z.string().trim().toUpperCase().max(8).optional(),
  sector: z.string().trim().max(80).optional(),
  sentimentImpact: z.coerce.number().min(-50).max(50).default(0),
  volatilityImpact: z.coerce.number().min(-50).max(50).default(15),
  liquidityImpact: z.coerce.number().min(-50).max(50).default(0),
  demandImpact: z.coerce.number().min(-50).max(50).default(0),
  durationTicks: z.coerce.number().int().min(3).max(300).default(45),
});

router.get("/state", (_req, res) => {
  res.json(getEngineSnapshot());
});

router.post("/shock", validateBody(shockSchema), (req, res) => {
  const event = addMarketEvent({
    ...req.body,
    type: "VOLATILITY_SHOCK",
    headline: "Simulated Event: manual practice-market shock",
    severity: Math.abs(req.body.volatilityImpact) >= 25 ? "HIGH" : "MEDIUM",
    createdTick: getEngineSnapshot().market.tick,
  });
  res.json({ event, snapshot: getEngineSnapshot() });
});

router.post("/event", validateBody(shockSchema), (req, res) => {
  const event = addMarketEvent({
    ...req.body,
    type: req.body.scope === "TICKER" ? "TICKER_NEWS" : req.body.scope === "SECTOR" ? "SECTOR_NEWS" : "MARKET_NEWS",
    headline: "Simulated Event: manual practice-market event",
    severity: "MEDIUM",
    createdTick: getEngineSnapshot().market.tick,
  });
  res.json({ event, snapshot: getEngineSnapshot() });
});

router.post("/fast-forward", validateBody(z.object({ ticks: z.coerce.number().int().min(1).max(200) })), (req, res) => {
  for (let index = 0; index < req.body.ticks; index += 1) updatePrices();
  res.json(getEngineSnapshot());
});

router.post("/reset", (_req, res) => {
  resetMarketClock();
  resetMarketState();
  resetEvents();
  updatePrices();
  res.json(getEngineSnapshot());
});

export default router;
