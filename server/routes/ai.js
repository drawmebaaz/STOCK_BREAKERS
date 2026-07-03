import { Router } from "express";
import axios from "axios";
import { protect } from "../middleware/auth.js";
import { env } from "../config/env.js";
import {
  predictionSchema,
  riskSchema,
  sentimentSchema,
  tickerSchema,
  validateBody,
} from "../middleware/validation.js";
import { getCandles, getIndex, getLivePrices, getMarketEvents, getMarketStatus, getPriceHistory, getQuote } from "../utils/priceStore.js";
import { calibrateScenarioRisk } from "../services/scenarioRisk.js";

const router = Router();
const ml = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 4500,
  maxContentLength: 1024 * 1024,
});

const percentile = (values, pct) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * pct;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const weight = index - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
};

const historyForScenario = (ticker, providedPrices) => {
  const clean = Array.isArray(providedPrices)
    ? providedPrices.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  if (clean.length >= 10) return clean.slice(-500);
  return getPriceHistory(ticker, 120).map(Number).filter((value) => Number.isFinite(value) && value > 0);
};

const scenarioPayload = (body) => ({
  ...body,
  prices: historyForScenario(body.ticker, body.prices),
});

const scenarioFallback = ({ ticker, prices = [], horizon = 30, simulations = 500, reason = "Scenario service temporarily unavailable" }) => {
  const clean = prices.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  const start = clean.at(-1) || getQuote(ticker)?.price || 1;
  const returns = clean.slice(1).map((price, index) => price / clean[index] - 1);
  const avgAbsMove = returns.length
    ? returns.reduce((sum, value) => sum + Math.abs(value), 0) / returns.length
    : 0.01;
  const move = Math.max(0.01, avgAbsMove * Math.sqrt(Math.max(1, Number(horizon || 30))));
  const days = Math.min(Math.max(Number(horizon) || 30, 1), 180);
  const forecast = {
    p5: [],
    p25: [],
    p50: [],
    p75: [],
    p95: [],
  };

  for (let index = 1; index <= days; index += 1) {
    const factor = Math.sqrt(index / days);
    forecast.p5.push(+(start * (1 - move * 1.2 * factor)).toFixed(2));
    forecast.p25.push(+(start * (1 - move * 0.5 * factor)).toFixed(2));
    forecast.p50.push(+start.toFixed(2));
    forecast.p75.push(+(start * (1 + move * 0.5 * factor)).toFixed(2));
    forecast.p95.push(+(start * (1 + move * 1.2 * factor)).toFixed(2));
  }

  return {
    status: "degraded",
    message: reason,
    ticker,
    S0: +start.toFixed(2),
    horizon: days,
    simulations: Math.min(Number(simulations) || 500, 1000),
    forecast,
    stats: {
      median_final: forecast.p50.at(-1),
      p5_final: forecast.p5.at(-1),
      p95_final: forecast.p95.at(-1),
      prob_gain: 50,
      downside_probability: 50,
      ann_volatility: +(avgAbsMove * Math.sqrt(252) * 100).toFixed(1),
      expected_return: 0,
      max_drawdown_estimate: +(-move * 100).toFixed(2),
    },
    scenario: {
      worstCase: forecast.p5.at(-1),
      baseCase: forecast.p50.at(-1),
      bestCase: forecast.p95.at(-1),
      plainEnglishRiskSummary:
        "Scenario service is unavailable, so this fallback uses recent in-app price movement only. Treat it as a rough practice range.",
    },
  };
};

router.get("/history/:ticker", protect, (req, res) => {
  const result = tickerSchema.safeParse(req.params.ticker);
  if (!result.success) return res.status(400).json({ error: "Invalid ticker" });

  const stock = getLivePrices().find((item) => item.ticker === result.data);
  const prices = getPriceHistory(result.data, 120);
  const candles = getCandles(result.data, 120);
  if (!stock || !prices) return res.status(404).json({ error: "Stock history not found" });

  if (req.query.mode === "candles") {
    return res.json({
      ticker: result.data,
      candles,
      prices,
      points: candles?.length || prices.length,
      quote: getQuote(result.data),
      marketStatus: getMarketStatus(),
      activeEvents: getMarketEvents({ ticker: result.data }).slice(0, 3),
      benchmark: getIndex("SBX_TOTAL"),
      source: "server-simulated-price-engine",
      simulationNotice: "Uses simulated in-app market data, not real market data.",
    });
  }

  res.json({
    ticker: result.data,
    prices,
    points: prices.length,
    currentPrice: stock.price,
    quote: getQuote(result.data),
    marketStatus: getMarketStatus(),
    activeEvents: getMarketEvents({ ticker: result.data }).slice(0, 3),
    benchmark: getIndex("SBX_TOTAL"),
    source: "server-simulated-price-engine",
    simulationNotice: "Rolling simulated market history maintained by the backend price engine.",
  });
});

router.post("/predict", protect, validateBody(predictionSchema), async (req, res) => {
  const payload = scenarioPayload(req.body);
  if (payload.prices.length < 10) return res.status(400).json({ error: "Not enough simulated price history for this stock yet" });
  try {
    const { data } = await ml.post("/predict", payload);
    res.json(data);
  } catch (err) {
    res.json(scenarioFallback({ ...payload, reason: err.code === "ECONNABORTED" ? "Scenario service timed out" : "Scenario service temporarily unavailable" }));
  }
});

router.post("/scenario", protect, validateBody(predictionSchema), async (req, res) => {
  const payload = scenarioPayload(req.body);
  if (payload.prices.length < 10) return res.status(400).json({ error: "Not enough simulated price history for this stock yet" });
  try {
    const { data } = await ml.post("/predict", payload);
    const finalPrices = [data.stats?.p5_final, data.stats?.median_final, data.stats?.p95_final].map(Number);
    const marketStatus = getMarketStatus();
    const activeEvents = getMarketEvents({ ticker: payload.ticker }).slice(0, 3);
    const benchmark = getIndex("SBX_TOTAL");
    res.json({
      ...data,
      status: "ok",
      marketContext: {
        session: marketStatus.session,
        simulatedTime: marketStatus.simulatedTime,
        volatilityRegime: marketStatus.volatilityRegime,
        activeEvents,
        benchmark,
      },
      scenario: {
        worstCase: finalPrices[0],
        baseCase: finalPrices[1],
        bestCase: finalPrices[2],
        downsideProbability: data.stats?.downside_probability ?? +(100 - Number(data.stats?.prob_gain || 0)).toFixed(1),
        gainProbability: data.stats?.prob_gain,
        volatility: data.stats?.ann_volatility,
        maxDrawdownEstimate: data.stats?.var_95,
        plainEnglishRiskSummary:
          activeEvents.length > 0
            ? "This simulated range includes current practice-market event context. Use it for learning risk, not for predicting real markets."
            : "This is a simulated scenario range based on StockBreakers practice prices. It is useful for learning risk, not for predicting real markets.",
      },
    });
  } catch (err) {
    res.json(scenarioFallback({ ...payload, reason: err.code === "ECONNABORTED" ? "Scenario service timed out" : "Scenario service temporarily unavailable" }));
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
  const quote = getQuote(req.body.ticker);
  const marketStatus = getMarketStatus();
  const activeEvents = getMarketEvents({ ticker: req.body.ticker }).slice(0, 3);
  try {
    const { data } = await ml.post("/risk", req.body);
    res.json(calibrateScenarioRisk({
      ticker: req.body.ticker,
      prices: req.body.prices,
      quote,
      marketStatus,
      activeEvents,
      mlRisk: data,
    }));
  } catch {
    const changes = req.body.prices.slice(1).map((price, index) => (price / req.body.prices[index] - 1) * 100);
    const downside = changes.length ? changes.filter((value) => value < 0).length / changes.length * 100 : 50;
    const swing = changes.length ? percentile(changes.map(Math.abs), 0.8) : 1;
    const fallbackRisk = {
      status: "degraded",
      score: Math.min(95, Math.max(5, Math.round(swing * 15 + downside * 0.2))),
      label: swing > 2.5 ? "High" : swing > 1.2 ? "Moderate" : "Low",
      color: swing > 2.5 ? "red" : swing > 1.2 ? "amber" : "green",
      metrics: {
        downside_probability: +downside.toFixed(1),
      },
    };
    res.json(calibrateScenarioRisk({
      ticker: req.body.ticker,
      prices: req.body.prices,
      quote,
      marketStatus,
      activeEvents,
      mlRisk: fallbackRisk,
    }));
  }
});

router.get("/suggestions", protect, async (req, res) => {
  try {
    const stocks = getLivePrices();
    const { data } = await ml.post("/suggestions", {
      watchlist: req.user.watchlist || [],
      stocks: stocks.map((s) => ({
        ticker: s.ticker,
        price: s.price,
        change: s.change,
        sector: s.sector,
      })),
    });
    res.json(data);
  } catch {
    res.json({ trending_up: [], dip_buys: [] });
  }
});

export default router;
