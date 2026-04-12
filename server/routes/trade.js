import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { buyStock, sellStock } from "../controllers/trade.js";
const router = Router();
router.post("/buy", protect, buyStock);
router.post("/sell", protect, sellStock);
export default router;
