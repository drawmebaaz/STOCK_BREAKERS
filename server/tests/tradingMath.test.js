import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDisciplineScore,
  calculateRiskPlan,
  calculateSlippage,
  estimateFillQuantity,
} from "../services/tradingMath.js";
import { orderPlacementSchema } from "../middleware/validation.js";

const quote = {
  mid: 100,
  price: 100,
  bid: 99.95,
  ask: 100.05,
  volume: 100000,
  averageVolume: 1000000,
  liquidityScore: 0.9,
  percentChange: 0.4,
};

test("slippage is positive for buys and negative for sells", () => {
  assert.ok(calculateSlippage({ quote, side: "BUY", quantity: 50 }) > 0);
  assert.ok(calculateSlippage({ quote, side: "SELL", quantity: 50 }) < 0);
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

test("fill estimate caps large orders by simulated liquidity", () => {
  const fill = estimateFillQuantity({ quote, quantity: 10000, orderType: "LIMIT" });
  assert.ok(fill > 0);
  assert.ok(fill < 10000);
});

test("discipline score penalizes repeated process issues", () => {
  const score = calculateDisciplineScore({
    totalTrades: 10,
    unplannedTrades: 2,
    tradesWithoutStop: 1,
    oversizedTrades: 1,
    poorExitCount: 1,
    revengeTradeSignals: 1,
  });
  assert.equal(score, 35);
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
