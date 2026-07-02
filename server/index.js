import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";

import authRoutes from "./routes/auth.js";
import stockRoutes from "./routes/stocks.js";
import tradeRoutes from "./routes/trade.js";
import orderRoutes from "./routes/orders.js";
import portfolioRoutes from "./routes/portfolio.js";
import transactionRoutes from "./routes/transactions.js";
import watchlistRoutes from "./routes/watchlist.js";
import aiRoutes from "./routes/ai.js";
import riskRoutes from "./routes/risk.js";
import disciplineRoutes from "./routes/discipline.js";
import marketRoutes from "./routes/market.js";
import simRoutes from "./routes/sim.js";
import tradePlanRoutes from "./routes/tradePlans.js";
import { env } from "./config/env.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { initPriceEngine } from "./sockets/priceEngine.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.CORS_ALLOW_ALL ? "*" : env.CORS_ORIGINS, methods: ["GET", "POST"] },
});

if (env.TRUST_PROXY) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      if (env.CORS_ALLOW_ALL || !origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      const error = new Error("Not allowed by CORS");
      error.status = 403;
      return callback(error);
    },
  })
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "50kb" }));
if (env.NODE_ENV !== "test") app.use(morgan(env.LOG_FORMAT));

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", service: "stockbreakers-api" });
});

app.get("/api/ready", (_, res) => {
  const readyState = mongoose.connection.readyState;
  const isReady = readyState === 1;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not_ready",
    mongo: isReady ? "connected" : "disconnected",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/discipline", disciplineRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/sim", simRoutes);
app.use("/api/trade-plans", tradePlanRoutes);

if (env.STATIC_DIR) {
  app.use(express.static(env.STATIC_DIR, { maxAge: env.isProduction ? "1h" : 0 }));
  app.get(/^\/(?!api\/).*/, (_, res) => {
    res.sendFile(path.join(env.STATIC_DIR, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
  });

  console.log("MongoDB connected");
  initPriceEngine(io);
  server.listen(env.PORT, () => console.log(`Server running on port ${env.PORT}`));
};

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await mongoose.connection.close(false);
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
