import { Router } from "express";
import {
  cancelOrderById,
  createOrder,
  getOrderById,
  getOrders,
} from "../controllers/orders.js";
import { protect } from "../middleware/auth.js";
import { orderPlacementSchema, orderQuerySchema, validateBody, validateQuery } from "../middleware/validation.js";

const router = Router();

router.post("/", protect, validateBody(orderPlacementSchema), createOrder);
router.get("/", protect, validateQuery(orderQuerySchema), getOrders);
router.get("/:id", protect, getOrderById);
router.post("/:id/cancel", protect, cancelOrderById);

export default router;
