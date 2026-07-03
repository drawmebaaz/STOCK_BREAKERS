import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDisciplineScore,
  calculateRiskPlan,
  calculateSlippage,
  estimateFillQuantity,
} from "../services/tradingMath.js";
import { estimateReservationAmount } from "../services/orderEngine.js";
import { calibrateScenarioRisk, priceRiskMetrics } from "../services/scenarioRisk.js";
import { orderPlacementSchema } from "../middleware/validation.js";
import { isTransactionUnavailableError } from "../utils/withMongoTransaction.js";

const quote = {
  mid: 100,
  price: 100,
  bid: 99.95,
  ask: 100.05,
  spread: 0.1,
  volume: 100000,
  averageVolume: 1000000,
  liquidityScore: 0.9,
  percentChange: 0.4,
  volatilityRegime: "NORMAL",
};

test("slippage is positive for buys and negative for sells", () => {
  assert.ok(calculateSlippage({ quote, side: "BUY", quantity: 50 }) > 0);
  assert.ok(calculateSlippage({ quote, side: "SELL", quantity: 50 }) < 0);
});

test("slippage increases when an order takes more visible liquidity", () => {
  const smallOrder = calculateSlippage({ quote, side: "BUY", quantity: 50 });
  const largeOrder = calculateSlippage({ quote, side: "BUY", quantity: 80000 });
  assert.ok(largeOrder > smallOrder);
});

test("slippage increases in thinner and more volatile conditions", () => {
  const calm = calculateSlippage({ quote: { ...quote, liquidityScore: 0.95, volatilityRegime: "LOW", activeEventCount: 0 }, side: "BUY", quantity: 500 });
  const stressed = calculateSlippage({
    quote: { ...quote, liquidityScore: 0.35, volatilityRegime: "CRASH", activeEventCount: 3, volume: 12000 },
    side: "BUY",
    quantity: 500,
  });
  assert.ok(stressed > calm);
});

test("buy limit reservation includes limit value and slippage buffer", () => {
  const reservation = estimateReservationAmount({
    quote,
    side: "BUY",
    type: "LIMIT",
    quantity: 10,
    limitPrice: 99,
  });
  assert.ok(reservation > 990);
});

test("market orders do not create long-lived reservations", () => {
  const reservation = estimateReservationAmount({
    quote,
    side: "BUY",
    type: "MARKET",
    quantity: 10,
    limitPrice: null,
  });
  assert.equal(reservation, 0);
});

test("transaction utility recognizes standalone MongoDB transaction errors", () => {
  assert.equal(isTransactionUnavailableError(new Error("Transaction numbers are only allowed on a replica set member or mongos")), true);
  assert.equal(isTransactionUnavailableError(new Error("ordinary validation problem")), false);
});

test("risk plan calculates max size and reward/risk", () => {
  const plan = calculateRiskPlan({
    side: "BUY",
    entryPrice: 100,
    stopLoss: 95,
    targetPrice: 112,
    quantity: 10,
    totalEquity: 10000,
    maxRiskPerTradePercent: 2,
  });

  assert.equal(plan.riskPerShare, 5);
  assert.equal(plan.plannedRiskAmount, 50);
  assert.equal(plan.rewardRiskRatio, 2.4);
  assert.equal(plan.maxQuantityByRisk, 40);
  assert.equal(plan.validStop, true);
});

test("scenario risk keeps stable low-volatility tickers low", () => {
  const prices = [100, 100.1, 100.05, 100.15, 100.08, 100.2, 100.18, 100.22, 100.19, 100.25, 100.24, 100.3];
  const risk = calibrateScenarioRisk({
    ticker: "JNJ",
    prices,
    quote: { price: 100.3, mid: 100.3, spread: 0.04, liquidityScore: 0.9, volatilityRegime: "NORMAL", activeEventCount: 0 },
    marketStatus: { session: "OPEN", volatilityRegime: "NORMAL" },
    activeEvents: [],
    mlRisk: { score: 8, metrics: priceRiskMetrics(prices) },
  });

  assert.equal(risk.label, "Low");
});

test("scenario risk upgrades speculative and event-heavy tickers", () => {
  const prices = [100, 101.8, 98.4, 103.2, 96.8, 104.5, 99.1, 107.2, 101.4, 95.5, 103.9, 97.2];
  const risk = calibrateScenarioRisk({
    ticker: "COIN",
    prices,
    quote: { price: 97.2, mid: 97.2, spread: 1.4, liquidityScore: 0.55, volatilityRegime: "NEWS_SHOCK", activeEventCount: 2 },
    marketStatus: { session: "AFTER_HOURS", volatilityRegime: "NEWS_SHOCK" },
    activeEvents: [{ id: "event-1" }, { id: "event-2" }],
    mlRisk: { score: 20, metrics: priceRiskMetrics(prices) },
  });

  assert.equal(risk.label, "High");
  assert.ok(risk.score >= 65);
});

test("fill estimate caps large orders by simulated liquidity", () => {
  const fill = estimateFillQuantity({ quote, quantity: 10000, orderType: "LIMIT" });
  assert.ok(fill > 0);
  assert.ok(fill < 10000);
});

test("discipline score penalizes repeated process issues", () => {
  const result = calculateDisciplineScore({
    totalTrades: 10,
    unplannedTrades: 2,
    tradesWithoutStop: 1,
    oversizedTrades: 1,
    poorExitCount: 1,
    revengeTradeSignals: 1,
    reviewedTrades: 4,
  });
  assert.equal(result.score, 79);
  assert.equal(result.confidence, "MEDIUM");
  assert.equal(result.components.planning, 0.8);
  assert.equal(result.components.review, 0.4);
});

test("discipline score avoids fake precision when there are no trades", () => {
  const result = calculateDisciplineScore({ totalTrades: 0 });
  assert.equal(result.score, null);
  assert.equal(result.label, "Not enough data");
  assert.equal(result.confidence, "LOW");
});

test("order validation requires limit price for limit orders", () => {
  const result = orderPlacementSchema.safeParse({
    ticker: "AAPL",
    side: "BUY",
    type: "LIMIT",
    quantity: 1,
    idempotencyKey: "order-key-123",
  });
  assert.equal(result.success, false);
  assert.equal(result.error.issues.some((issue) => issue.path.join(".") === "limitPrice"), true);
});
