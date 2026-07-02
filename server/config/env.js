import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const emptyToUndefined = (value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const logFormats = ["dev", "combined", "common", "short", "tiny"];
const normalizeLogFormat = (value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized !== "string") return normalized;
  const trimmed = normalized.trim();
  return logFormats.includes(trimmed) ? trimmed : undefined;
};

const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1).default("mongodb://localhost:27017/stockbreakers"),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ML_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(250),
  LOG_FORMAT: z.preprocess(normalizeLogFormat, z.enum(logFormats).default("dev")),
  TRUST_PROXY: z.preprocess(parseBoolean, z.boolean()).default(false),
  STATIC_DIR: z.preprocess(emptyToUndefined, z.string().optional()),
  MARKET_CLOCK_ENABLED: z.preprocess(parseBoolean, z.boolean()).default(true),
  MARKET_DEMO_ALWAYS_OPEN: z.preprocess(parseBoolean, z.boolean()).default(false),
  SIM_MINUTES_PER_TICK: z.coerce.number().int().positive().default(5),
  AFTER_HOURS_MINUTES_PER_TICK: z.coerce.number().int().positive().default(30),
  MARKET_TICK_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid server environment:\n${details.join("\n")}`);
}

const data = result.data;
const isProduction = data.NODE_ENV === "production";
const devJwtSecret = "dev-only-stockbreakers-secret-change-before-production";

if (isProduction && (!data.JWT_SECRET || data.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
}

const origins = Array.from(
  new Set([...splitOrigins(data.CORS_ORIGINS), data.CLIENT_URL])
);
const corsAllowAll = origins.includes("*");

export const env = {
  ...data,
  JWT_SECRET: data.JWT_SECRET || devJwtSecret,
  CORS_ORIGINS: origins,
  CORS_ALLOW_ALL: corsAllowAll,
  isProduction,
};
