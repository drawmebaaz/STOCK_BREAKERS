import { z } from "zod";

export const tickerSchema = z
  .string()
  .trim()
  .min(1, "Ticker is required")
  .max(8, "Ticker is too long")
  .regex(/^[A-Za-z.]+$/, "Ticker can only contain letters and dots")
  .transform((value) => value.toUpperCase());

export const authRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export const authLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const orderSchema = z.object({
  ticker: tickerSchema,
  quantity: z.coerce.number().int().min(1).max(10000),
});

const orderStatusSchema = z.enum(["PENDING", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED", "EXPIRED"]);

export const orderPlacementSchema = z
  .object({
    ticker: tickerSchema,
    side: z.enum(["BUY", "SELL"]).transform((value) => value.toUpperCase()),
    type: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
    quantity: z.coerce.number().int().min(1).max(100000),
    limitPrice: z.coerce.number().positive().max(100000).optional().nullable(),
    idempotencyKey: z.string().trim().min(8).max(120),
    tradePlan: z
      .object({
        thesis: z.string().trim().max(1200).optional().default(""),
        setupType: z
          .enum(["BREAKOUT", "PULLBACK", "MOMENTUM", "REVERSAL", "RANGE", "EARNINGS_RISK", "PRACTICE", "OTHER"])
          .optional()
          .default("PRACTICE"),
        entryReason: z.string().trim().max(800).optional().default(""),
        invalidationReason: z.string().trim().max(800).optional().default(""),
        stopLoss: z.coerce.number().positive().max(100000).optional().nullable(),
        targetPrice: z.coerce.number().positive().max(100000).optional().nullable(),
        confidence: z.coerce.number().int().min(1).max(5).optional().default(3),
        plannedHoldingPeriod: z.enum(["INTRADAY", "SWING", "POSITION", "PRACTICE"]).optional().default("PRACTICE"),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "LIMIT" && !value.limitPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["limitPrice"],
        message: "Limit price is required for limit orders",
      });
    }
  });

export const orderQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  ticker: tickerSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const watchlistSchema = z.object({
  ticker: tickerSchema,
});

export const riskSettingsSchema = z.object({
  maxRiskPerTradePercent: z.coerce.number().min(0.1).max(25).optional(),
  maxPortfolioRiskPercent: z.coerce.number().min(0.1).max(50).optional(),
  maxTickerExposurePercent: z.coerce.number().min(1).max(100).optional(),
  maxSectorExposurePercent: z.coerce.number().min(1).max(100).optional(),
  defaultStopLossPercent: z.coerce.number().min(0.1).max(50).optional(),
  requireTradePlan: z.coerce.boolean().optional(),
  warnOnOversizing: z.coerce.boolean().optional(),
});

export const tradePlanSchema = z.object({
  ticker: tickerSchema,
  side: z.enum(["BUY", "SELL"]),
  thesis: z.string().trim().max(1200).optional().default(""),
  setupType: z
    .enum(["BREAKOUT", "PULLBACK", "MOMENTUM", "REVERSAL", "RANGE", "EARNINGS_RISK", "PRACTICE", "OTHER"])
    .optional()
    .default("PRACTICE"),
  entryReason: z.string().trim().max(800).optional().default(""),
  invalidationReason: z.string().trim().max(800).optional().default(""),
  stopLoss: z.coerce.number().positive().optional(),
  targetPrice: z.coerce.number().positive().optional(),
  confidence: z.coerce.number().int().min(1).max(5).optional().default(3),
  plannedHoldingPeriod: z.enum(["INTRADAY", "SWING", "POSITION", "PRACTICE"]).optional().default("PRACTICE"),
});

export const tradeReviewSchema = z.object({
  exitReason: z.string().trim().max(800).optional().default(""),
  followedPlan: z.coerce.boolean().optional().default(false),
  mistakeTags: z
    .array(z.enum(["NO_STOP", "MOVED_STOP", "EXITED_EARLY", "HELD_TOO_LONG", "OVERSIZED", "REVENGE_TRADE", "NO_THESIS", "IGNORED_RISK_LIMIT", "CHASING", "OTHER"]))
    .max(12)
    .optional()
    .default([]),
  emotionalState: z
    .enum(["CALM", "FEARFUL", "GREEDY", "BORED", "FRUSTRATED", "CONFIDENT", "OTHER"])
    .optional()
    .default("CALM"),
  lesson: z.string().trim().max(1200).optional().default(""),
});

export const predictionSchema = z.object({
  ticker: tickerSchema,
  prices: z.array(z.coerce.number().positive()).min(10).max(500).optional(),
  horizon: z.coerce.number().int().min(1).max(180).default(30),
  simulations: z.coerce.number().int().min(100).max(5000).default(500),
});

export const sentimentSchema = z.object({
  ticker: tickerSchema,
  text: z.string().max(5000).optional(),
});

export const riskSchema = z.object({
  ticker: tickerSchema,
  prices: z.array(z.coerce.number().positive()).min(10).max(500),
});

export const transactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const formatIssues = (issues) =>
  issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: formatIssues(result.error.issues),
    });
  }
  req.body = result.data;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: formatIssues(result.error.issues),
    });
  }
  req.validatedQuery = result.data;
  next();
};
