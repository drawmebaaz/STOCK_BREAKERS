import { getInstrumentProfile } from "../utils/instrumentProfiles.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const percentile = (values, pct) => {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const index = (clean.length - 1) * pct;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const weight = index - low;
  return clean[low] * (1 - weight) + clean[high] * weight;
};

export const priceRiskMetrics = (prices = []) => {
  const clean = prices.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  const logReturns = clean.slice(1).map((price, index) => Math.log(price / clean[index]));
  const simpleReturnsPct = logReturns.map((value) => (Math.exp(value) - 1) * 100);
  const mean = logReturns.length ? logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length : 0;
  const variance = logReturns.length
    ? logReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / logReturns.length
    : 0;
  const annVolatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  let peak = clean[0] || 0;
  let maxDrawdown = 0;
  clean.forEach((price) => {
    peak = Math.max(peak, price);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, (price - peak) / peak);
  });
  const var95 = percentile(simpleReturnsPct, 0.05);
  const tail = simpleReturnsPct.filter((value) => value <= var95);
  const cvar95 = tail.length ? tail.reduce((sum, value) => sum + value, 0) / tail.length : var95;
  const downsideProbability = simpleReturnsPct.length
    ? (simpleReturnsPct.filter((value) => value < 0).length / simpleReturnsPct.length) * 100
    : 50;
  const recentWindow = simpleReturnsPct.slice(-10);
  const recentAverageMove = recentWindow.length
    ? recentWindow.reduce((sum, value) => sum + Math.abs(value), 0) / recentWindow.length
    : 0;

  return {
    ann_volatility: round(annVolatility, 1),
    max_drawdown: round(Math.abs(maxDrawdown) * 100, 1),
    var_95: round(var95, 2),
    cvar_95: round(cvar95, 2),
    downside_probability: round(downsideProbability, 1),
    recent_average_move: round(recentAverageMove, 2),
  };
};

const profileRiskScore = (profile) => {
  if (!profile) return 12;
  const baseVolatilityScore = {
    LOW: 8,
    NORMAL: 16,
    HIGH: 30,
    EXTREME: 42,
  }[profile.baseVolatility] ?? 16;
  const betaScore = clamp((Number(profile.betaToMarket || 1) - 0.75) * 11, 0, 18);
  const liquidityScore = clamp((100 - Number(profile.liquidityScore || 85)) * 0.35, 0, 14);
  const spreadScore = clamp(Number(profile.baseSpreadBps || 5) * 0.75, 0, 14);
  const styleScore = {
    SPECULATIVE: 8,
    GROWTH: 4,
    VALUE: 2,
    QUALITY: 1,
    DIVIDEND: 0,
  }[profile.style] ?? 2;
  return baseVolatilityScore + betaScore + liquidityScore + spreadScore + styleScore;
};

const marketContextScore = ({ quote, marketStatus, activeEvents }) => {
  const regime = String(marketStatus?.volatilityRegime || quote?.volatilityRegime || quote?.regime || "NORMAL").toUpperCase();
  const regimeScore = {
    LOW_VOLATILITY: 0,
    LOW: 0,
    NORMAL: 4,
    HIGH_VOLATILITY: 14,
    HIGH: 14,
    NEWS_SHOCK: 18,
    CRASH: 28,
    RECOVERY: 10,
  }[regime] ?? 4;
  const session = String(marketStatus?.session || quote?.marketSession || "OPEN").toUpperCase();
  const sessionScore = {
    OPEN: 0,
    PRE_MARKET: 8,
    AFTER_HOURS: 8,
    CLOSED: 4,
  }[session] ?? 0;
  const eventScore = clamp((activeEvents?.length || Number(quote?.activeEventCount || 0)) * 6, 0, 18);
  const price = Number(quote?.mid || quote?.price || 0);
  const spreadPct = price > 0 ? (Number(quote?.spread || 0) / price) * 100 : 0;
  const spreadScore = clamp(spreadPct * 35, 0, 12);
  const quoteLiquidityScore = clamp((1 - Number(quote?.liquidityScore || 0.85)) * 20, 0, 12);
  return regimeScore + sessionScore + eventScore + spreadScore + quoteLiquidityScore;
};

const statisticalScore = (metrics) => {
  const vol = clamp((Number(metrics.ann_volatility || 0) / 45) * 32, 0, 32);
  const drawdown = clamp((Number(metrics.max_drawdown || 0) / 14) * 26, 0, 26);
  const cvar = clamp((Math.abs(Number(metrics.cvar_95 || metrics.var_95 || 0)) / 3.5) * 20, 0, 20);
  const downside = clamp((Number(metrics.downside_probability || 50) - 42) * 0.45, 0, 14);
  const recentMove = clamp((Number(metrics.recent_average_move || 0) / 2.5) * 8, 0, 8);
  return vol + drawdown + cvar + downside + recentMove;
};

export const calibrateScenarioRisk = ({ ticker, prices = [], quote = null, marketStatus = null, activeEvents = [], mlRisk = {} }) => {
  const profile = getInstrumentProfile(ticker);
  const observed = priceRiskMetrics(prices);
  const metrics = {
    ...observed,
    ...(mlRisk.metrics || {}),
    recent_average_move: observed.recent_average_move,
  };

  const priceScore = statisticalScore(metrics);
  const profileScore = profileRiskScore(profile);
  const contextScore = marketContextScore({ quote, marketStatus, activeEvents });
  const mlScore = Number.isFinite(Number(mlRisk.score)) ? Number(mlRisk.score) : 0;
  const score = Math.round(clamp(Math.max(mlScore, priceScore * 0.52 + profileScore * 0.34 + contextScore * 0.36), 5, 95));

  const label = score >= 65 ? "High" : score >= 35 ? "Moderate" : "Low";
  const color = score >= 65 ? "red" : score >= 35 ? "amber" : "green";

  return {
    ...mlRisk,
    ticker: String(ticker || mlRisk.ticker || "").toUpperCase(),
    score,
    label,
    color,
    metrics: {
      ...metrics,
      profile_risk_score: round(profileScore, 1),
      market_context_score: round(contextScore, 1),
    },
    explanation:
      label === "High"
        ? "Higher risk because recent movement, ticker profile, liquidity, or current simulated market context is elevated."
        : label === "Moderate"
          ? "Moderate risk because the ticker or current simulated market context needs position-size discipline."
          : "Lower risk in the current simulated sample, but still use stops and position sizing.",
  };
};
