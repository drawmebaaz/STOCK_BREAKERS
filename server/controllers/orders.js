import {
  cancelOrder,
  getUserOrder,
  listOrders,
  placeOrder,
} from "../services/orderEngine.js";

export const createOrder = async (req, res, next) => {
  try {
    const result = await placeOrder(req.user, req.body);
    res.status(result.idempotent ? 200 : 201).json({
      success: result.order.status !== "REJECTED",
      order: result.order,
      transaction: result.transaction || null,
      snapshot: result.snapshot || null,
      idempotent: Boolean(result.idempotent),
    });
  } catch (err) {
    next(err);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const data = await listOrders(req.user._id, req.validatedQuery);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await getUserOrder(req.user._id, req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (err) {
    next(err);
  }
};

export const cancelOrderById = async (req, res, next) => {
  try {
    const order = await cancelOrder(req.user._id, req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};
