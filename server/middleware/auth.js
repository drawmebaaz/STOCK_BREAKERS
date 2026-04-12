import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authorized" });
  }
  try {
    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ error: "User not found" });
    next();
  } catch {
    res.status(401).json({ error: "Token invalid" });
  }
};
