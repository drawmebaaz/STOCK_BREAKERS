import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { riskSettingsSchema, validateBody } from "../middleware/validation.js";
import { RiskSettings } from "../models/index.js";
import { getOrCreateRiskSettings } from "../services/orderEngine.js";

const router = Router();

router.get("/settings", protect, async (req, res, next) => {
  try {
    const settings = await getOrCreateRiskSettings(req.user._id);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", protect, validateBody(riskSettingsSchema), async (req, res, next) => {
  try {
    const settings = await RiskSettings.findOneAndUpdate(
      { userId: req.user._id },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

export default router;
