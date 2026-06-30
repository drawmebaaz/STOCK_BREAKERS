import mongoose from "mongoose";
import {
  EquitySnapshot,
  Holding,
  Order,
  RiskSettings,
  TradePlan,
  Transaction,
  User,
} from "../models/index.js";
import { getLivePrices, getQuote, isKnownTicker } from "../utils/priceStore.js";
import {
  calculateRiskPlan,
  calculateSlippage,
  estimateFillQuantity,
  roundMoney,
} from "./tradingMath.js";

const DEFAULT_ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_PER_TICK = 50;

let warnedAboutStandaloneWrites = false;

const objectId = (value) => (mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null);

const isFillableStatus = (status) => ["PENDING", "PARTIALLY_FILLED"].includes(status);

const orderPublicShape = (order) => {
  const doc = typeof order.toObject === "function" ? order.toObject() : order;
  return {
    ...doc,
    canCancel: isFillableStatus(doc.status),
  };
};

export const getOrCreateRiskSettings = async (userId) => {
  const existing = await RiskSettings.findOne({ userId });
  if (existing) return existing;
  return RiskSettings.create({ userId });
};

export const calculatePortfolioSnapshot = async (userId, userDoc = null) => {
  const [user, holdings] = await Promise.all([
    userDoc ? Promise.resolve(userDoc) : User.findById(userId),
    Holding.find({ userId }),
  ]);

  const cash = Number(user?.cashBalance || 0);
  let marketValue = 0;
  let invested = 0;

  holdings.forEach((holding) => {
    const quote = getQuote(holding.ticker);
    const price = Number(quote?.mid || quote?.price || holding.avgCost || 0);
    marketValue += price * holding.quantity;
    invested += holding.totalInvested;
  });

  return {
    cash: roundMoney(cash),
    marketValue: roundMoney(marketValue),
    totalEquity: roundMoney(cash + marketValue),
    invested: roundMoney(invested),
    holdings,
  };
};

const saveEquitySnapshot = async (userId, userDoc = null) => {
  const snapshot = await calculatePortfolioSnapshot(userId, userDoc);
  await EquitySnapshot.create({
    userId,
    cash: snapshot.cash,
    marketValue: snapshot.marketValue,
    totalEquity: snapshot.totalEquity,
  });
  return snapshot;
};

const estimateWorstCaseCost = ({ quote, side, quantity, type, limitPrice }) => {
  const slippage = calculateSlippage({ quote, side, quantity });
  const basePrice = side === "BUY" ? quote.ask : quote.bid;
  const price = type === "LIMIT" && side === "BUY"
    ? Math.min(Number(limitPrice), basePrice + Math.abs(slippage))
    : basePrice + slippage;
  return Math.max(0, price * quantity);
};

const createPlanIfNeeded = async ({ userId, payload, quote, totalEquity, riskSettings }) => {
  const plan = payload.tradePlan || {};
  const hasPlan =
    Boolean(plan.thesis?.trim()) ||
    Boolean(plan.entryReason?.trim()) ||
    Boolean(plan.invalidationReason?.trim()) ||
    Number(plan.stopLoss || 0) > 0 ||
    Number(plan.targetPrice || 0) > 0;

  if (!hasPlan) return null;

  const estimatedEntry = payload.side === "BUY"
    ? Number(quote.ask || quote.price)
    : Number(quote.bid || quote.price);
  const riskPlan = calculateRiskPlan({
    side: payload.side,
    entryPrice: estimatedEntry,
    stopLoss: plan.stopLoss,
    targetPrice: plan.targetPrice,
    quantity: payload.quantity,
    totalEquity,
    maxRiskPerTradePercent: riskSettings.maxRiskPerTradePercent,
  });

  return TradePlan.create({
    userId,
    ticker: payload.ticker,
    side: payload.side,
    thesis: plan.thesis || "",
    setupType: plan.setupType || "PRACTICE",
    entryReason: plan.entryReason || "",
    invalidationReason: plan.invalidationReason || "",
    stopLoss: Number(plan.stopLoss || 0),
    targetPrice: Number(plan.targetPrice || 0),
    confidence: Number(plan.confidence || 3),
    plannedHoldingPeriod: plan.plannedHoldingPeriod || "PRACTICE",
    plannedRiskAmount: riskPlan.plannedRiskAmount,
    plannedRewardAmount: riskPlan.plannedRewardAmount,
    plannedRiskPercent: riskPlan.plannedRiskPercent,
    rewardRiskRatio: riskPlan.rewardRiskRatio,
    positionSizeWarning: riskPlan.positionSizeWarning,
  });
};

const applyBuyFill = async ({ user, order, quote, fillQuantity, fillPrice, tradePlan }) => {
  const total = roundMoney(fillQuantity * fillPrice);
  const freshUser = await User.findOneAndUpdate(
    { _id: user._id, cashBalance: { $gte: total } },
    { $inc: { cashBalance: -total } },
    { new: true, runValidators: true }
  );
  if (!freshUser) {
    return { rejected: true, reason: "Insufficient virtual cash for the fill price" };
  }

  const holding = await Holding.findOne({ userId: user._id, ticker: order.ticker });
  if (holding) {
    const newQuantity = holding.quantity + fillQuantity;
    const newInvested = roundMoney(holding.totalInvested + total);
    holding.quantity = newQuantity;
    holding.totalInvested = newInvested;
    holding.avgCost = roundMoney(newInvested / newQuantity, 4);
    await holding.save();
  } else {
    await Holding.create({
      userId: user._id,
      ticker: order.ticker,
      quantity: fillQuantity,
      avgCost: fillPrice,
      totalInvested: total,
    });
  }

  const transaction = await Transaction.create({
    userId: user._id,
    orderId: order._id,
    fillId: `${order._id}-${Date.now()}`,
    tradePlanId: tradePlan?._id || order.tradePlanId || null,
    type: "buy",
    side: "BUY",
    orderType: order.type,
    ticker: order.ticker,
    quantity: fillQuantity,
    price: fillPrice,
    total,
    filledQuantity: fillQuantity,
    fillPrice,
    bid: quote.bid,
    ask: quote.ask,
    spreadPaid: roundMoney((quote.ask - quote.bid) * fillQuantity, 4),
    slippage: roundMoney((fillPrice - quote.ask) * fillQuantity, 4),
    fees: 0,
    realizedPnl: null,
    realizedR: null,
    positionAfter: holding ? holding.quantity : fillQuantity,
    avgCostBefore: holding ? holding.avgCost : null,
  });

  return { user: freshUser, transaction };
};

const applySellFill = async ({ user, order, quote, fillQuantity, fillPrice, tradePlan }) => {
  const holding = await Holding.findOne({ userId: user._id, ticker: order.ticker });
  if (!holding || holding.quantity < fillQuantity) {
    return { rejected: true, reason: "Not enough shares available to sell" };
  }

  const avgCostBefore = holding.avgCost;
  const total = roundMoney(fillQuantity * fillPrice);
  const realizedPnl = roundMoney((fillPrice - avgCostBefore) * fillQuantity);
  const plannedRisk = Number(tradePlan?.plannedRiskAmount || 0);
  const realizedR = plannedRisk > 0 ? roundMoney(realizedPnl / plannedRisk, 2) : null;

  holding.quantity -= fillQuantity;
  holding.totalInvested = roundMoney(Math.max(0, holding.totalInvested - avgCostBefore * fillQuantity));
  if (holding.quantity <= 0) {
    await holding.deleteOne();
  } else {
    await holding.save();
  }

  const freshUser = await User.findByIdAndUpdate(
    user._id,
    { $inc: { cashBalance: total } },
    { new: true, runValidators: true }
  );

  const transaction = await Transaction.create({
    userId: user._id,
    orderId: order._id,
    fillId: `${order._id}-${Date.now()}`,
    tradePlanId: tradePlan?._id || order.tradePlanId || null,
    type: "sell",
    side: "SELL",
    orderType: order.type,
    ticker: order.ticker,
    quantity: fillQuantity,
    price: fillPrice,
    total,
    filledQuantity: fillQuantity,
    fillPrice,
    bid: quote.bid,
    ask: quote.ask,
    spreadPaid: roundMoney((quote.ask - quote.bid) * fillQuantity, 4),
    slippage: roundMoney((quote.bid - fillPrice) * fillQuantity, 4),
    fees: 0,
    realizedPnl,
    realizedR,
    positionAfter: Math.max(0, holding.quantity),
    avgCostBefore,
  });

  if (tradePlan && holding.quantity <= 0) {
    tradePlan.status = "CLOSED";
    tradePlan.closedAt = new Date();
    await tradePlan.save();
  }

  return { user: freshUser, transaction };
};

const updateOrderAfterFill = async ({ order, fillQuantity, fillPrice, quote, slippage }) => {
  const previousFilledValue = Number(order.avgFillPrice || 0) * Number(order.filledQuantity || 0);
  const nextFilledQuantity = Number(order.filledQuantity || 0) + fillQuantity;
  const nextFilledValue = previousFilledValue + fillQuantity * fillPrice;
  order.filledQuantity = nextFilledQuantity;
  order.remainingQuantity = Math.max(0, order.quantity - nextFilledQuantity);
  order.avgFillPrice = roundMoney(nextFilledValue / nextFilledQuantity, 4);
  order.actualSlippage = roundMoney(Number(order.actualSlippage || 0) + slippage * fillQuantity, 4);
  order.spreadPaid = roundMoney(Number(order.spreadPaid || 0) + (quote.ask - quote.bid) * fillQuantity, 4);
  order.status = order.remainingQuantity === 0 ? "FILLED" : "PARTIALLY_FILLED";
  if (order.status === "FILLED") order.filledAt = new Date();
  await order.save();
};

const canLimitFill = (order, quote) => {
  if (order.type !== "LIMIT") return true;
  if (order.side === "BUY") return Number(quote.ask) <= Number(order.limitPrice);
  return Number(quote.bid) >= Number(order.limitPrice);
};

export const attemptFillOrder = async (orderInput) => {
  const order = typeof orderInput.save === "function" ? orderInput : await Order.findById(orderInput);
  if (!order || !isFillableStatus(order.status)) return { order };

  if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
    order.status = "EXPIRED";
    await order.save();
    return { order };
  }

  const quote = getQuote(order.ticker);
  if (!quote) return { order, warning: "Quote unavailable" };

  const updatedAt = quote.updatedAt ? new Date(quote.updatedAt).getTime() : 0;
  if (updatedAt && Date.now() - updatedAt > 30000) {
    return { order, warning: "Quote is stale" };
  }

  if (!canLimitFill(order, quote)) return { order };

  const user = await User.findById(order.userId);
  if (!user) {
    order.status = "REJECTED";
    order.rejectionReason = "User account was not found";
    await order.save();
    return { order };
  }

  const remaining = Number(order.remainingQuantity || 0);
  const fillQuantity = estimateFillQuantity({ quote, quantity: remaining, orderType: order.type });
  if (fillQuantity < 1) return { order, warning: "No fillable quantity available" };

  const slippage = calculateSlippage({ quote, side: order.side, quantity: fillQuantity });
  const rawFillPrice = order.side === "BUY"
    ? Number(quote.ask) + Math.abs(slippage)
    : Number(quote.bid) - Math.abs(slippage);
  const fillPrice = roundMoney(Math.max(0.01, rawFillPrice), 4);

  const tradePlan = order.tradePlanId ? await TradePlan.findById(order.tradePlanId) : null;
  const result = order.side === "BUY"
    ? await applyBuyFill({ user, order, quote, fillQuantity, fillPrice, tradePlan })
    : await applySellFill({ user, order, quote, fillQuantity, fillPrice, tradePlan });

  if (result.rejected) {
    order.status = order.filledQuantity > 0 ? "PARTIALLY_FILLED" : "REJECTED";
    order.rejectionReason = result.reason;
    await order.save();
    return { order, rejected: true, reason: result.reason };
  }

  await updateOrderAfterFill({ order, fillQuantity, fillPrice, quote, slippage: Math.abs(slippage) });
  const snapshot = await saveEquitySnapshot(order.userId, result.user);
  return { order, transaction: result.transaction, snapshot };
};

export const placeOrder = async (userInput, payload) => {
  if (!warnedAboutStandaloneWrites && mongoose.connection.readyState === 1) {
    warnedAboutStandaloneWrites = true;
    console.warn("StockBreakers order engine uses safe sequential writes in local/demo mode. Use a MongoDB replica set for multi-document transactions in production.");
  }

  const user = await User.findById(userInput._id);
  const ticker = String(payload.ticker || "").toUpperCase();
  const side = String(payload.side || "").toUpperCase();
  const type = String(payload.type || "MARKET").toUpperCase();

  if (!isKnownTicker(ticker)) {
    const error = new Error("Stock is not available in the simulator");
    error.status = 404;
    throw error;
  }

  const existing = await Order.findOne({ userId: user._id, idempotencyKey: payload.idempotencyKey });
  if (existing) return { order: existing, idempotent: true };

  const quote = getQuote(ticker);
  if (!quote) {
    const error = new Error("Market quote is unavailable");
    error.status = 503;
    throw error;
  }

  const quantity = Number(payload.quantity);
  const limitPrice = type === "LIMIT" ? Number(payload.limitPrice) : null;
  const riskSettings = await getOrCreateRiskSettings(user._id);
  const snapshot = await calculatePortfolioSnapshot(user._id, user);

  if (side === "BUY") {
    const worstCaseCost = estimateWorstCaseCost({ quote, side, quantity, type, limitPrice });
    if (Number(user.cashBalance || 0) < worstCaseCost) {
      const rejected = await Order.create({
        userId: user._id,
        ticker,
        side,
        type,
        quantity,
        limitPrice,
        status: "REJECTED",
        requestedPrice: quote.mid,
        requestedBid: quote.bid,
        requestedAsk: quote.ask,
        remainingQuantity: quantity,
        estimatedSlippage: calculateSlippage({ quote, side, quantity }),
        rejectionReason: "Insufficient virtual cash for this order",
        idempotencyKey: payload.idempotencyKey,
        expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
      });
      return { order: rejected };
    }
  }

  if (side === "SELL") {
    const holding = await Holding.findOne({ userId: user._id, ticker });
    if (!holding || holding.quantity < quantity) {
      const rejected = await Order.create({
        userId: user._id,
        ticker,
        side,
        type,
        quantity,
        limitPrice,
        status: "REJECTED",
        requestedPrice: quote.mid,
        requestedBid: quote.bid,
        requestedAsk: quote.ask,
        remainingQuantity: quantity,
        estimatedSlippage: calculateSlippage({ quote, side, quantity }),
        rejectionReason: "Not enough shares available to sell",
        idempotencyKey: payload.idempotencyKey,
        expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
      });
      return { order: rejected };
    }
  }

  const tradePlan = await createPlanIfNeeded({
    userId: user._id,
    payload: { ...payload, ticker, side, type, quantity },
    quote,
    totalEquity: snapshot.totalEquity,
    riskSettings,
  });

  const order = await Order.create({
    userId: user._id,
    ticker,
    side,
    type,
    quantity,
    limitPrice,
    requestedPrice: quote.mid,
    requestedBid: quote.bid,
    requestedAsk: quote.ask,
    avgFillPrice: 0,
    filledQuantity: 0,
    remainingQuantity: quantity,
    estimatedSlippage: calculateSlippage({ quote, side, quantity }),
    idempotencyKey: payload.idempotencyKey,
    tradePlanId: tradePlan?._id || null,
    expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
  });

  if (tradePlan) {
    tradePlan.orderId = order._id;
    await tradePlan.save();
  }

  const filled = await attemptFillOrder(order);
  return { ...filled, order: filled.order || order };
};

export const listOrders = async (userId, query = {}) => {
  const filter = { userId };
  if (query.status) filter.status = query.status;
  if (query.ticker) filter.ticker = query.ticker;
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  return { orders: orders.map(orderPublicShape), page, limit };
};

export const getUserOrder = async (userId, orderId) => {
  const id = objectId(orderId);
  if (!id) return null;
  const order = await Order.findOne({ _id: id, userId });
  return order ? orderPublicShape(order) : null;
};

export const cancelOrder = async (userId, orderId) => {
  const id = objectId(orderId);
  if (!id) return null;
  const order = await Order.findOne({ _id: id, userId });
  if (!order) return null;
  if (!isFillableStatus(order.status)) {
    const error = new Error("Only pending or partially filled orders can be cancelled");
    error.status = 400;
    throw error;
  }
  order.status = "CANCELLED";
  order.cancelledAt = new Date();
  await order.save();
  return orderPublicShape(order);
};

export const processPendingOrders = async ({ limit = MAX_PENDING_PER_TICK } = {}) => {
  const orders = await Order.find({ status: { $in: ["PENDING", "PARTIALLY_FILLED"] } })
    .sort({ createdAt: 1 })
    .limit(limit);

  const results = [];
  for (const order of orders) {
    try {
      results.push(await attemptFillOrder(order));
    } catch (err) {
      console.warn(`Pending order ${order._id} skipped: ${err.message}`);
      results.push({ order, error: err.message });
    }
  }
  return results;
};

export const availableStocksWithQuotes = () => getLivePrices();
