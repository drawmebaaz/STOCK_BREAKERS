import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    cashBalance: { type: Number, default: 50000, min: 0 },
    watchlist: {
      type: [String],
      default: [],
      validate: {
        validator: (items) => items.every((ticker) => /^[A-Z.]{1,8}$/.test(ticker)),
        message: "Watchlist contains an invalid ticker",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

const HoldingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8 },
    quantity: { type: Number, required: true, min: 0 },
    avgCost: { type: Number, required: true, min: 0 },
    totalInvested: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
HoldingSchema.index({ userId: 1, ticker: 1 }, { unique: true });

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["buy", "sell"], required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, maxlength: 8 },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
TransactionSchema.index({ userId: 1, createdAt: -1 });

export const User = mongoose.model("User", UserSchema);
export const Holding = mongoose.model("Holding", HoldingSchema);
export const Transaction = mongoose.model("Transaction", TransactionSchema);
