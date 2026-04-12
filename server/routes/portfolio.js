import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getPortfolio, getPortfolioSummary } from "../controllers/portfolio.js";
const router = Router();
router.get("/", protect, getPortfolio);
router.get("/summary", protect, getPortfolioSummary);
export default router;
