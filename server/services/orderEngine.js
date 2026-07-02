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
import { getLivePrices, getMarketStatus, getQuote, isKnownTicker } from "../utils/priceStore.js";
import {
  calculateRiskPlan,
  calculateSlippage,
  estimateFillQuantity,
  roundMoney,
} from "./tradingMath.js";
import { withMongoTransaction } from "../utils/withMongoTransaction.js";

const DEFAULT_ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_PER_TICK = 50;

let warnedAboutStandaloneWrites = false;

const objectId = (value) => (mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null);

const isFillableStatus = (status) => ["PENDING", "PARTIALLY_FILLED"].includes(status);
const sessionOptions = (session) => (session ? { session } : {});
const withSession = (query, session) => (session ? query.session(session) : query);
const createOne = async (Model, doc, session) => {
  if (!session) return Model.create(doc);
  const [created] = await Model.create([doc], { session });
  return created;
};

const orderPublicShape = (order) => {
  const doc = typeof order.toObject === "function" ? order.toObject() : order;
  return {
    ...doc,
    canCancel: isFillableStatus(doc.status),
  };
};

const availableCashOf = (user) => Math.max(0, Number(user?.cashBalance || 0) - Number(user?.reservedCash || 0));
const availableSharesOf = (holding) => Math.max(0, Number(holding?.quantity || 0) - Number(holding?.reservedQuantity || 0));

export const getOrCreateRiskSettings = async (userId, session = null) => {
  const existing = await withSession(RiskSettings.findOne({ userId }), session);
  if (existing) return existing;
  return createOne(RiskSettings, { userId }, session);
};

export const calculatePortfolioSnapshot = async (userId, userDoc = null, session = null) => {
  const [user, holdings] = await Promise.all([
    userDoc ? Promise.resolve(userDoc) : withSession(User.findById(userId), session),
    withSession(Holding.find({ userId }), session),
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
    reservedCash: roundMoney(Number(user?.reservedCash || 0)),
    availableCash: roundMoney(availableCashOf(user)),
    marketValue: roundMoney(marketValue),
    totalEquity: roundMoney(cash + marketValue),
    invested: roundMoney(invested),
    holdings,
  };
};

const saveEquitySnapshot = async (userId, userDoc = null, session = null) => {
  const snapshot = await calculatePortfolioSnapshot(userId, userDoc, session);
  await createOne(EquitySnapshot, {
    userId,
    cash: snapshot.cash,
    marketValue: snapshot.marketValue,
    totalEquity: snapshot.totalEquity,
  }, session);
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

export const estimateReservationAmount = ({ quote, side, quantity, type, limitPrice }) => {
  if (type !== "LIMIT" || side !== "BUY") return 0;
  const limit = Number(limitPrice || 0);
  if (limit <= 0) return 0;
  const slippageBuffer = Math.abs(calculateSlippage({ quote, side, quantity })) * quantity;
  return roundMoney(limit * quantity + slippageBuffer, 2);
};

export const reserveCash = async (userId, amount, session = null) => {
  const value = roundMoney(amount);
  if (value <= 0) return null;
  return withSession(User.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $gte: [
          { $subtract: ["$cashBalance", { $ifNull: ["$reservedCash", 0] }] },
          value,
        ],
      },
    },
    { $inc: { reservedCash: value } },
    { new: true, runValidators: true }
  ), session);
};

export const releaseCash = async (userId, amount, session = null) => {
  const value = roundMoney(amount);
  if (value <= 0) return null;
  const user = await withSession(User.findById(userId), session);
  if (!user) return null;
  user.reservedCash = roundMoney(Math.max(0, Number(user.reservedCash || 0) - value));
  return user.save(sessionOptions(session));
};

export const consumeReservedCash = async (userId, reservedAmount, actualCost, session = null) => {
  const reserved = roundMoney(reservedAmount);
  const cost = roundMoney(actualCost);
  const user = await withSession(User.findById(userId), session);
  if (!user) return null;
  const availableIncludingThisReservation = availableCashOf(user) + reserved;
  if (availableIncludingThisReservation < cost) return null;
  user.cashBalance = roundMoney(Number(user.cashBalance || 0) - cost);
  user.reservedCash = roundMoney(Math.max(0, Number(user.reservedCash || 0) - reserved));
  return user.save(sessionOptions(session));
};

export const reserveShares = async (userId, ticker, quantity, session = null) => {
  const qty = Number(quantity || 0);
  if (qty <= 0) return null;
  return withSession(Holding.findOneAndUpdate(
    {
      userId,
      ticker,
      $expr: {
        $gte: [
          { $subtract: ["$quantity", { $ifNull: ["$reservedQuantity", 0] }] },
          qty,
        ],
      },
    },
    { $inc: { reservedQuantity: qty } },
    { new: true, runValidators: true }
  ), session);
};

export const releaseShares = async (userId, ticker, quantity, session = null) => {
  const qty = Number(quantity || 0);
  if (qty <= 0) return null;
  const holding = await withSession(Holding.findOne({ userId, ticker }), session);
  if (!holding) return null;
  holding.reservedQuantity = Math.max(0, Number(holding.reservedQuantity || 0) - qty);
  return holding.save(sessionOptions(session));
};

export const consumeReservedShares = async (userId, ticker, quantity, session = null) => {
  const qty = Number(quantity || 0);
  if (qty <= 0) return null;
  const holding = await withSession(Holding.findOne({ userId, ticker }), session);
  if (!holding || Number(holding.quantity || 0) < qty) return null;
  holding.quantity = Math.max(0, Number(holding.quantity || 0) - qty);
  holding.reservedQuantity = Math.max(0, Number(holding.reservedQuantity || 0) - qty);
  return holding;
};

const reservationPortionForFill = (order, fillQuantity) => {
  const remainingBeforeFill = Number(order.remainingQuantity || 0);
  if (remainingBeforeFill <= 0) return 0;
  return roundMoney((Number(order.reservedCashAmount || 0) / remainingBeforeFill) * fillQuantity);
};

const releaseOrderReservation = async (order, session = null) => {
  if (!order || order.reservationStatus !== "RESERVED") return;
  if (Number(order.reservedCashAmount || 0) > 0) {
    await releaseCash(order.userId, order.reservedCashAmount, session);
    order.reservedCashAmount = 0;
  }
  if (Number(order.reservedShareQuantity || 0) > 0) {
    await releaseShares(order.userId, order.ticker, order.reservedShareQuantity, session);
    order.reservedShareQuantity = 0;
  }
  order.reservationStatus = "RELEASED";
  order.reservationReleasedAt = new Date();
};

const createPlanIfNeeded = async ({ userId, payload, quote, totalEquity, riskSettings, session = null }) => {
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

  return createOne(TradePlan, {
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
  }, session);
};

const applyBuyFill = async ({ user, order, quote, fillQuantity, fillPrice, tradePlan, session = null }) => {
  const total = roundMoney(fillQuantity * fillPrice);
  const reservedPortion = reservationPortionForFill(order, fillQuantity);
  const freshUser = reservedPortion > 0
    ? await consumeReservedCash(user._id, reservedPortion, total, session)
    : await withSession(User.findOneAndUpdate(
      {
        _id: user._id,
        $expr: {
          $gte: [
            { $subtract: ["$cashBalance", { $ifNull: ["$reservedCash", 0] }] },
            total,
          ],
        },
      },
      { $inc: { cashBalance: -total } },
      { new: true, runValidators: true }
    ), session);
  if (!freshUser) {
    return { rejected: true, reason: "Insufficient virtual cash for the fill price" };
  }
  order.reservedCashAmount = roundMoney(Math.max(0, Number(order.reservedCashAmount || 0) - reservedPortion));

  const holding = await withSession(Holding.findOne({ userId: user._id, ticker: order.ticker }), session);
  if (holding) {
    const newQuantity = holding.quantity + fillQuantity;
    const newInvested = roundMoney(holding.totalInvested + total);
    holding.quantity = newQuantity;
    holding.totalInvested = newInvested;
    holding.avgCost = roundMoney(newInvested / newQuantity, 4);
    await holding.save(sessionOptions(session));
  } else {
    await createOne(Holding, {
      userId: user._id,
      ticker: order.ticker,
      quantity: fillQuantity,
      avgCost: fillPrice,
      totalInvested: total,
    }, session);
  }

  const transaction = await createOne(Transaction, {
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
  }, session);

  return { user: freshUser, transaction };
};

const applySellFill = async ({ user, order, quote, fillQuantity, fillPrice, tradePlan, session = null }) => {
  let holding = await withSession(Holding.findOne({ userId: user._id, ticker: order.ticker }), session);
  if (!holding || holding.quantity < fillQuantity) {
    return { rejected: true, reason: "Not enough shares available to sell" };
  }

  const avgCostBefore = holding.avgCost;
  const total = roundMoney(fillQuantity * fillPrice);
  const realizedPnl = roundMoney((fillPrice - avgCostBefore) * fillQuantity);
  const plannedRisk = Number(tradePlan?.plannedRiskAmount || 0);
  const realizedR = plannedRisk > 0 ? roundMoney(realizedPnl / plannedRisk, 2) : null;

  if (Number(order.reservedShareQuantity || 0) > 0) {
    holding = await consumeReservedShares(user._id, order.ticker, fillQuantity, session);
    if (!holding) return { rejected: true, reason: "Reserved shares were not available for this fill" };
    order.reservedShareQuantity = Math.max(0, Number(order.reservedShareQuantity || 0) - fillQuantity);
  } else {
    if (availableSharesOf(holding) < fillQuantity) return { rejected: true, reason: "Not enough available shares to sell" };
    holding.quantity -= fillQuantity;
  }
  holding.totalInvested = roundMoney(Math.max(0, holding.totalInvested - avgCostBefore * fillQuantity));
  if (holding.quantity <= 0) {
    await holding.deleteOne(sessionOptions(session));
  } else {
    await holding.save(sessionOptions(session));
  }

  const freshUser = await withSession(User.findByIdAndUpdate(
    user._id,
    { $inc: { cashBalance: total } },
    { new: true, runValidators: true }
  ), session);

  const transaction = await createOne(Transaction, {
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
  }, session);

  if (tradePlan && holding.quantity <= 0) {
    tradePlan.status = "CLOSED";
    tradePlan.closedAt = new Date();
    await tradePlan.save(sessionOptions(session));
  }

  return { user: freshUser, transaction };
};

const updateOrderAfterFill = async ({ order, fillQuantity, fillPrice, quote, slippage, session = null }) => {
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
  await order.save(sessionOptions(session));
};

const canLimitFill = (order, quote) => {
  if (order.type !== "LIMIT") return true;
  if (order.side === "BUY") return Number(quote.ask) <= Number(order.limitPrice);
  return Number(quote.bid) >= Number(order.limitPrice);
};

const attemptFillOrderInTransaction = async (orderInput, session = null) => {
  const order = typeof orderInput.save === "function"
    ? orderInput
    : await withSession(Order.findById(orderInput), session);
  if (!order || !isFillableStatus(order.status)) return { order };

  if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
    order.status = "EXPIRED";
    await releaseOrderReservation(order, session);
    await order.save(sessionOptions(session));
    return { order };
  }

  const quote = getQuote(order.ticker);
  if (!quote) return { order, warning: "Quote unavailable" };

  const market = getMarketStatus();
  if (order.type === "MARKET" && !market.allowsMarketOrders) {
    order.status = order.filledQuantity > 0 ? "PARTIALLY_FILLED" : "REJECTED";
    order.rejectionReason = "MARKET_CLOSED: market orders wait until the simulated market reopens";
    await order.save(sessionOptions(session));
    return { order, rejected: true, reason: order.rejectionReason };
  }

  const updatedAt = quote.updatedAt ? new Date(quote.updatedAt).getTime() : 0;
  if (updatedAt && Date.now() - updatedAt > 30000) {
    return { order, warning: "Quote is stale" };
  }

  if (!canLimitFill(order, quote)) return { order };

  const user = await withSession(User.findById(order.userId), session);
  if (!user) {
    order.status = "REJECTED";
    order.rejectionReason = "User account was not found";
    await order.save(sessionOptions(session));
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

  const tradePlan = order.tradePlanId ? await withSession(TradePlan.findById(order.tradePlanId), session) : null;
  const result = order.side === "BUY"
    ? await applyBuyFill({ user, order, quote, fillQuantity, fillPrice, tradePlan, session })
    : await applySellFill({ user, order, quote, fillQuantity, fillPrice, tradePlan, session });

  if (result.rejected) {
    order.status = order.filledQuantity > 0 ? "PARTIALLY_FILLED" : "REJECTED";
    order.rejectionReason = result.reason;
    if (order.status === "REJECTED") await releaseOrderReservation(order, session);
    await order.save(sessionOptions(session));
    return { order, rejected: true, reason: result.reason };
  }

  await updateOrderAfterFill({ order, fillQuantity, fillPrice, quote, slippage: Math.abs(slippage), session });
  if (order.status === "FILLED" && order.reservationStatus === "RESERVED") {
    await releaseOrderReservation(order, session);
    order.reservationStatus = "CONSUMED";
    order.reservationReleasedAt = new Date();
    await order.save(sessionOptions(session));
  }
  const snapshot = await saveEquitySnapshot(order.userId, result.user, session);
  return { order, transaction: result.transaction, snapshot };
};

export const attemptFillOrder = async (orderInput) =>
  withMongoTransaction((session) => attemptFillOrderInTransaction(orderInput, session), { allowFallback: true });

const placeOrderInTransaction = async (userInput, payload, session = null) => {
  if (!warnedAboutStandaloneWrites && mongoose.connection.readyState === 1) {
    warnedAboutStandaloneWrites = true;
    console.warn("StockBreakers order engine uses safe sequential writes in local/demo mode. Use a MongoDB replica set for multi-document transactions in production.");
  }

  const user = await withSession(User.findById(userInput._id), session);
  const ticker = String(payload.ticker || "").toUpperCase();
  const side = String(payload.side || "").toUpperCase();
  const type = String(payload.type || "MARKET").toUpperCase();
  const quantity = Number(payload.quantity);
  const limitPrice = type === "LIMIT" ? Number(payload.limitPrice) : null;

  if (!isKnownTicker(ticker)) {
    const error = new Error("Stock is not available in the simulator");
    error.status = 404;
    throw error;
  }

  const existing = await withSession(Order.findOne({ userId: user._id, idempotencyKey: payload.idempotencyKey }), session);
  if (existing) return { order: existing, idempotent: true };

  const quote = getQuote(ticker);
  if (!quote) {
    const error = new Error("Market quote is unavailable");
    error.status = 503;
    throw error;
  }

  const market = getMarketStatus();
  if (type === "MARKET" && !market.allowsMarketOrders) {
    const rejected = await createOne(Order, {
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
      rejectionReason: "MARKET_CLOSED: market orders can only fill during simulated trading sessions",
      idempotencyKey: payload.idempotencyKey,
      expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
    }, session);
    return { order: rejected };
  }

  const riskSettings = await getOrCreateRiskSettings(user._id, session);
  const snapshot = await calculatePortfolioSnapshot(user._id, user, session);
  let reservedCashAmount = 0;
  let reservedShareQuantity = 0;

  if (side === "BUY") {
    const worstCaseCost = estimateWorstCaseCost({ quote, side, quantity, type, limitPrice });
    if (availableCashOf(user) < worstCaseCost) {
      const rejected = await createOne(Order, {
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
        rejectionReason: "Insufficient available virtual cash for this order",
        idempotencyKey: payload.idempotencyKey,
        expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
      }, session);
      return { order: rejected };
    }
    if (type === "LIMIT") {
      reservedCashAmount = estimateReservationAmount({ quote, side, quantity, type, limitPrice });
      const reservedUser = await reserveCash(user._id, reservedCashAmount, session);
      if (!reservedUser) {
        const rejected = await createOne(Order, {
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
          rejectionReason: "Insufficient available virtual cash for this pending limit order",
          idempotencyKey: payload.idempotencyKey,
          expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
        }, session);
        return { order: rejected };
      }
    }
  }

  if (side === "SELL") {
    const holding = await withSession(Holding.findOne({ userId: user._id, ticker }), session);
    if (!holding || availableSharesOf(holding) < quantity) {
      const rejected = await createOne(Order, {
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
        rejectionReason: "Not enough available shares to sell",
        idempotencyKey: payload.idempotencyKey,
        expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
      }, session);
      return { order: rejected };
    }
    if (type === "LIMIT") {
      const reservedHolding = await reserveShares(user._id, ticker, quantity, session);
      if (!reservedHolding) {
        const rejected = await createOne(Order, {
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
          rejectionReason: "Not enough available shares to reserve for this pending limit order",
          idempotencyKey: payload.idempotencyKey,
          expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
        }, session);
        return { order: rejected };
      }
      reservedShareQuantity = quantity;
    }
  }

  const tradePlan = await createPlanIfNeeded({
    userId: user._id,
    payload: { ...payload, ticker, side, type, quantity },
    quote,
    totalEquity: snapshot.totalEquity,
    riskSettings,
    session,
  });

  const order = await createOne(Order, {
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
    reservedCashAmount,
    reservedShareQuantity,
    reservationStatus: reservedCashAmount > 0 || reservedShareQuantity > 0 ? "RESERVED" : "NONE",
    reservationCreatedAt: reservedCashAmount > 0 || reservedShareQuantity > 0 ? new Date() : null,
    idempotencyKey: payload.idempotencyKey,
    tradePlanId: tradePlan?._id || null,
    expiresAt: new Date(Date.now() + DEFAULT_ORDER_EXPIRY_MS),
  }, session);

  if (tradePlan) {
    tradePlan.orderId = order._id;
    await tradePlan.save(sessionOptions(session));
  }

  const filled = await attemptFillOrderInTransaction(order, session);
  return { ...filled, order: filled.order || order };
};

export const placeOrder = async (userInput, payload) =>
  withMongoTransaction((session) => placeOrderInTransaction(userInput, payload, session), { allowFallback: true });

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
  await releaseOrderReservation(order);
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
