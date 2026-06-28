// routes/auth.js
import { Router } from "express";
import { register, login, googleLogin, getMe } from "../controllers/auth.js";
import { protect } from "../middleware/auth.js";
import {
  authLoginSchema,
  authRegisterSchema,
  googleAuthSchema,
  validateBody,
} from "../middleware/validation.js";

const router = Router();

router.post("/register", validateBody(authRegisterSchema), register);
router.post("/login", validateBody(authLoginSchema), login);
router.post("/google", validateBody(googleAuthSchema), googleLogin);
router.get("/me", protect, getMe);

export default router;
