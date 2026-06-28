import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/index.js";
import { env } from "../config/env.js";

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const signToken = (id) =>
  jwt.sign({ sub: id.toString() }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  cashBalance: user.cashBalance,
  watchlist: user.watchlist,
});

const verifyGoogleCredential = async (credential) => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    const error = new Error("Google sign-in is not configured");
    error.status = 503;
    throw error;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload?.email) {
    const error = new Error("Google account could not be verified");
    error.status = 401;
    throw error;
  }

  if (payload.email_verified !== true) {
    const error = new Error("Google email is not verified");
    error.status = 401;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    avatarUrl: payload.picture,
  };
};

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
    if (!user.password) return res.status(401).json({ error: "Use Google sign-in for this account" });

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

export const googleLogin = async (req, res, next) => {
  try {
    const profile = await verifyGoogleCredential(req.body.credential);
    let user = await User.findOne({
      $or: [{ googleId: profile.googleId }, { email: profile.email }],
    }).select("+googleId");

    if (user) {
      let changed = false;
      if (!user.googleId) {
        user.googleId = profile.googleId;
        changed = true;
      }
      if (!user.avatarUrl && profile.avatarUrl) {
        user.avatarUrl = profile.avatarUrl;
        changed = true;
      }
      if (changed) await user.save();
    } else {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
      });
    }

    res.json({
      token: signToken(user._id),
      user: serializeUser(user),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

export const getMe = async (req, res) => {
  res.json({ user: serializeUser(req.user) });
};
