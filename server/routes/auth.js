// routes/auth.js
import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.js";
import { protect } from "../middleware/auth.js";
import { authLoginSchema, authRegisterSchema, validateBody } from "../middleware/validation.js";

const router = Router();

router.post("/register", validateBody(authRegisterSchema), register);
router.post("/login", validateBody(authLoginSchema), login);
router.get("/me", protect, getMe);

export default router;
