import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { env } from "../config/env.js";

const signToken = (id) =>
  jwt.sign({ sub: id.toString() }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  cashBalance: user.cashBalance,
  watchlist: user.watchlist,
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });

    res.status(201).json({
      token: signToken(user._id),
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.password) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      token: signToken(user._id),
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res) => {
  res.json({ user: serializeUser(req.user) });
};
