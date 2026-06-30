import { placeOrder } from "../services/orderEngine.js";

const legacyOrderPayload = (req, side) => ({
  ticker: req.body.ticker,
  quantity: req.body.quantity,
  side,
  type: "MARKET",
  idempotencyKey: req.body.idempotencyKey || `legacy-${side}-${req.user._id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  tradePlan: {
    setupType: "PRACTICE",
    plannedHoldingPeriod: "PRACTICE",
    thesis: "Quick practice order from the classic trade endpoint.",
  },
});

const executeLegacyOrder = async (req, res, next, side) => {
  try {
    const result = await placeOrder(req.user, legacyOrderPayload(req, side));
    const isRejected = result.order.status === "REJECTED";
    res.status(isRejected ? 400 : 200).json({
      success: !isRejected,
      cashBalance: result.snapshot?.cash ?? result.user?.cashBalance ?? req.user.cashBalance,
      order: result.order,
      transaction: result.transaction || null,
      error: isRejected ? result.order.rejectionReason : undefined,
    });
  } catch (err) {
    next(err);
  }
};

export const buyStock = (req, res, next) => executeLegacyOrder(req, res, next, "BUY");

export const sellStock = (req, res, next) => executeLegacyOrder(req, res, next, "SELL");
