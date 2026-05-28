import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/index.js";

const demoUser = {
  name: process.env.DEMO_USER_NAME || "Demo Trader",
  email: process.env.DEMO_USER_EMAIL || "demo@stockbreakers.local",
  password: process.env.DEMO_USER_PASSWORD || "DemoPass123!",
  cashBalance: Number(process.env.DEMO_USER_CASH || 50000),
};

const run = async () => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  const password = await bcrypt.hash(demoUser.password, 12);
  const user = await User.findOneAndUpdate(
    { email: demoUser.email },
    {
      $set: {
        name: demoUser.name,
        email: demoUser.email,
        password,
        cashBalance: demoUser.cashBalance,
      },
      $setOnInsert: { watchlist: ["AAPL", "NVDA", "MSFT"] },
    },
    { upsert: true, new: true, runValidators: true }
  );

  console.log(`Demo user ready: ${user.email}`);
  await mongoose.connection.close(false);
};

run().catch(async (err) => {
  console.error(err.message);
  await mongoose.connection.close(false).catch(() => {});
  process.exit(1);
});
