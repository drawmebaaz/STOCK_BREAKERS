import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, select: false },
    cashBalance: { type: Number, default: 50000, min: 0 },
    reservedCash: { type: Number, default: 0, min: 0 },
    watchlist: {
      type: [String],
      default: [],
      validate: {
        validator: (items) => items.every((ticker) => /^[A-Z.]{1,8}$/.test(ticker)),
        message: "Watchlist contains an invalid ticker",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8, index: true },
    side: { type: String, enum: ["BUY", "SELL"], required: true },
    type: { type: String, enum: ["MARKET", "LIMIT"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    limitPrice: { type: Number, default: null, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    requestedPrice: { type: Number, required: true, min: 0 },
    requestedBid: { type: Number, required: true, min: 0 },
    requestedAsk: { type: Number, required: true, min: 0 },
    avgFillPrice: { type: Number, default: 0, min: 0 },
    filledQuantity: { type: Number, default: 0, min: 0 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    estimatedSlippage: { type: Number, default: 0 },
    actualSlippage: { type: Number, default: 0 },
    spreadPaid: { type: Number, default: 0 },
    reservedCashAmount: { type: Number, default: 0, min: 0 },
    reservedShareQuantity: { type: Number, default: 0, min: 0 },
    reservationStatus: {
      type: String,
      enum: ["NONE", "RESERVED", "RELEASED", "CONSUMED"],
      default: "NONE",
      index: true,
    },
    reservationCreatedAt: { type: Date, default: null },
    reservationReleasedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 400 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    tradePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "TradePlan", default: null },
    source: { type: String, enum: ["USER", "SYSTEM"], default: "USER" },
    filledAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, status: 1 });
OrderSchema.index({ userId: 1, ticker: 1 });
OrderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

const HoldingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8 },
    quantity: { type: Number, required: true, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    avgCost: { type: Number, required: true, min: 0 },
    totalInvested: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
HoldingSchema.index({ userId: 1, ticker: 1 }, { unique: true });

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    fillId: { type: String, trim: true, maxlength: 80 },
    tradePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "TradePlan", default: null },
    type: { type: String, enum: ["buy", "sell"], required: true },
    side: { type: String, enum: ["BUY", "SELL"] },
    orderType: { type: String, enum: ["MARKET", "LIMIT"] },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8 },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    filledQuantity: { type: Number, min: 0 },
    fillPrice: { type: Number, min: 0 },
    bid: { type: Number, min: 0 },
    ask: { type: Number, min: 0 },
    spreadPaid: { type: Number, default: 0 },
    slippage: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    realizedPnl: { type: Number, default: null },
    realizedR: { type: Number, default: null },
    positionAfter: { type: Number, default: null },
    avgCostBefore: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
TransactionSchema.index({ userId: 1, createdAt: -1 });

const TradePlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8, index: true },
    side: { type: String, enum: ["BUY", "SELL"], required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    status: { type: String, enum: ["OPEN", "CLOSED", "CANCELLED"], default: "OPEN", index: true },
    thesis: { type: String, trim: true, maxlength: 1200 },
    setupType: {
      type: String,
      enum: ["BREAKOUT", "PULLBACK", "MOMENTUM", "REVERSAL", "RANGE", "EARNINGS_RISK", "PRACTICE", "OTHER"],
      default: "PRACTICE",
    },
    entryReason: { type: String, trim: true, maxlength: 800 },
    invalidationReason: { type: String, trim: true, maxlength: 800 },
    stopLoss: { type: Number, min: 0 },
    targetPrice: { type: Number, min: 0 },
    confidence: { type: Number, min: 1, max: 5, default: 3 },
    plannedHoldingPeriod: {
      type: String,
      enum: ["INTRADAY", "SWING", "POSITION", "PRACTICE"],
      default: "PRACTICE",
    },
    plannedRiskAmount: { type: Number, default: 0 },
    plannedRewardAmount: { type: Number, default: 0 },
    rewardRiskRatio: { type: Number, default: 0 },
    plannedRiskPercent: { type: Number, default: 0 },
    positionSizeWarning: { type: Boolean, default: false },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
TradePlanSchema.index({ userId: 1, createdAt: -1 });

const TradeReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tradePlanId: { type: mongoose.Schema.Types.ObjectId, ref: "TradePlan", required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8 },
    orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    exitReason: { type: String, trim: true, maxlength: 800 },
    followedPlan: { type: Boolean, default: false },
    mistakeTags: [{
      type: String,
      enum: ["NO_STOP", "MOVED_STOP", "EXITED_EARLY", "HELD_TOO_LONG", "OVERSIZED", "REVENGE_TRADE", "NO_THESIS", "IGNORED_RISK_LIMIT", "CHASING", "OTHER"],
    }],
    emotionalState: {
      type: String,
      enum: ["CALM", "FEARFUL", "GREEDY", "BORED", "FRUSTRATED", "CONFIDENT", "OTHER"],
      default: "CALM",
    },
    lesson: { type: String, trim: true, maxlength: 1200 },
    realizedPnl: { type: Number, default: 0 },
    realizedR: { type: Number, default: null },
    holdingPeriodMinutes: { type: Number, default: null },
  },
  { timestamps: true }
);
TradeReviewSchema.index({ userId: 1, createdAt: -1 });

const RiskSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    maxRiskPerTradePercent: { type: Number, default: 2, min: 0.1, max: 25 },
    maxPortfolioRiskPercent: { type: Number, default: 6, min: 0.1, max: 50 },
    maxTickerExposurePercent: { type: Number, default: 25, min: 1, max: 100 },
    maxSectorExposurePercent: { type: Number, default: 40, min: 1, max: 100 },
    defaultStopLossPercent: { type: Number, default: 5, min: 0.1, max: 50 },
    requireTradePlan: { type: Boolean, default: true },
    warnOnOversizing: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const EquitySnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    totalEquity: { type: Number, required: true },
    cash: { type: Number, required: true },
    marketValue: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);
EquitySnapshotSchema.index({ userId: 1, timestamp: -1 });

export const User = mongoose.model("User", UserSchema);
export const Order = mongoose.model("Order", OrderSchema);
export const Holding = mongoose.model("Holding", HoldingSchema);
export const Transaction = mongoose.model("Transaction", TransactionSchema);
export const TradePlan = mongoose.model("TradePlan", TradePlanSchema);
export const TradeReview = mongoose.model("TradeReview", TradeReviewSchema);
export const RiskSettings = mongoose.model("RiskSettings", RiskSettingsSchema);
export const EquitySnapshot = mongoose.model("EquitySnapshot", EquitySnapshotSchema);
