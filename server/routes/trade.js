import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { buyStock, sellStock } from "../controllers/trade.js";
import { orderSchema, validateBody } from "../middleware/validation.js";

const router = Router();

router.post("/buy", protect, validateBody(orderSchema), buyStock);
router.post("/sell", protect, validateBody(orderSchema), sellStock);

export default router;
