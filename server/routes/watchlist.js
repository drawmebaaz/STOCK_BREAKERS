import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { User } from "../models/index.js";
const router = Router();
router.post("/add", protect, async (req, res) => {
  try {
    const { ticker } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { watchlist: ticker.toUpperCase() } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post("/remove", protect, async (req, res) => {
  try {
    const { ticker } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $pull: { watchlist: ticker.toUpperCase() } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
