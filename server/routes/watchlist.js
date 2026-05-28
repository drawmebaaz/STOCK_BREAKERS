import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validateBody, watchlistSchema } from "../middleware/validation.js";
import { User } from "../models/index.js";

const router = Router();

router.post("/add", protect, validateBody(watchlistSchema), async (req, res, next) => {
  try {
    const { ticker } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { watchlist: ticker } }, { runValidators: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/remove", protect, validateBody(watchlistSchema), async (req, res, next) => {
  try {
    const { ticker } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $pull: { watchlist: ticker } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
