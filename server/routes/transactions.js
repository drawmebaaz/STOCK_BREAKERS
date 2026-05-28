import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { transactionQuerySchema, validateQuery } from "../middleware/validation.js";
import { Transaction } from "../models/index.js";

const router = Router();

router.get("/", protect, validateQuery(transactionQuerySchema), async (req, res, next) => {
  try {
    const txns = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(req.validatedQuery.limit);
    res.json({ transactions: txns });
  } catch (err) {
    next(err);
  }
});

export default router;
