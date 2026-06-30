import mongoose from "mongoose";
import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { tradePlanSchema, tradeReviewSchema, validateBody } from "../middleware/validation.js";
import { TradePlan, TradeReview, Transaction } from "../models/index.js";
import { calculatePortfolioSnapshot, getOrCreateRiskSettings } from "../services/orderEngine.js";
import { calculateRiskPlan } from "../services/tradingMath.js";
import { getQuote } from "../utils/priceStore.js";

const router = Router();

const safeObjectId = (value) => (mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null);

router.get("/", protect, async (req, res, next) => {
  try {
    const plans = await TradePlan.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(404).json({ error: "Trade plan not found" });
    const plan = await TradePlan.findOne({ _id: id, userId: req.user._id });
    if (!plan) return res.status(404).json({ error: "Trade plan not found" });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, validateBody(tradePlanSchema), async (req, res, next) => {
  try {
    const [snapshot, settings] = await Promise.all([
      calculatePortfolioSnapshot(req.user._id, req.user),
      getOrCreateRiskSettings(req.user._id),
    ]);
    const quote = getQuote(req.body.ticker);
    const entryPrice = req.body.side === "BUY" ? quote?.ask : quote?.bid;
    const risk = calculateRiskPlan({
      side: req.body.side,
      entryPrice,
      stopLoss: req.body.stopLoss,
      targetPrice: req.body.targetPrice,
      quantity: 1,
      totalEquity: snapshot.totalEquity,
      maxRiskPerTradePercent: settings.maxRiskPerTradePercent,
    });
    const plan = await TradePlan.create({
      userId: req.user._id,
      ...req.body,
      plannedRiskAmount: risk.riskPerShare,
      plannedRewardAmount: risk.rewardPerShare,
      plannedRiskPercent: snapshot.totalEquity > 0 ? +(risk.riskPerShare / snapshot.totalEquity * 100).toFixed(2) : 0,
      rewardRiskRatio: risk.rewardRiskRatio,
      positionSizeWarning: false,
    });
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", protect, async (req, res, next) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(404).json({ error: "Trade plan not found" });
    const allowed = [
      "status",
      "thesis",
      "setupType",
      "entryReason",
      "invalidationReason",
      "stopLoss",
      "targetPrice",
      "confidence",
      "plannedHoldingPeriod",
    ];
    const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (patch.status === "CLOSED") patch.closedAt = new Date();
    const plan = await TradePlan.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ error: "Trade plan not found" });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/review", protect, validateBody(tradeReviewSchema), async (req, res, next) => {
  try {
    const id = safeObjectId(req.params.id);
    if (!id) return res.status(404).json({ error: "Trade plan not found" });
    const plan = await TradePlan.findOne({ _id: id, userId: req.user._id });
    if (!plan) return res.status(404).json({ error: "Trade plan not found" });
    const fills = await Transaction.find({ userId: req.user._id, tradePlanId: plan._id, type: "sell" });
    const realizedPnl = fills.reduce((sum, fill) => sum + Number(fill.realizedPnl || 0), 0);
    const rValues = fills.map((fill) => fill.realizedR).filter((value) => value !== null && value !== undefined);
    const review = await TradeReview.create({
      userId: req.user._id,
      tradePlanId: plan._id,
      ticker: plan.ticker,
      orderIds: plan.orderId ? [plan.orderId] : [],
      ...req.body,
      realizedPnl,
      realizedR: rValues.length ? +(rValues.reduce((sum, value) => sum + Number(value), 0) / rValues.length).toFixed(2) : null,
      holdingPeriodMinutes: plan.closedAt ? Math.max(0, Math.round((plan.closedAt - plan.createdAt) / 60000)) : null,
    });
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
});

export default router;
