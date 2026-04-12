import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { Transaction } from "../models/index.js";
const router = Router();
router.get("/", protect, async (req, res) => {
  try {
    const txns = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).limit(50);
    res.json({ transactions: txns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
