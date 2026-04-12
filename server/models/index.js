import mongoose from "mongoose";

// ── User ──────────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    cashBalance: { type: Number, default: 50000 },
    watchlist: [String],
  },
  { timestamps: true }
);

// ── Holding ───────────────────────────────────────────────────────────────────
const HoldingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ticker: { type: String, required: true },
    quantity: { type: Number, required: true },
    avgCost: { type: Number, required: true },
    totalInvested: { type: Number, required: true },
  },
  { timestamps: true }
);
HoldingSchema.index({ userId: 1, ticker: 1 }, { unique: true });

// ── Transaction ───────────────────────────────────────────────────────────────
const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["buy", "sell"], required: true },
    ticker: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
export const Holding = mongoose.model("Holding", HoldingSchema);
export const Transaction = mongoose.model("Transaction", TransactionSchema);
