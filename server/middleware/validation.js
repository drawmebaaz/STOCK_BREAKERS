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

export const watchlistSchema = z.object({
  ticker: tickerSchema,
});

export const predictionSchema = z.object({
  ticker: tickerSchema,
  prices: z.array(z.coerce.number().positive()).min(10).max(500),
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
