import { volatilityMultiplierFor } from "./instrumentProfiles.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));

const regimeMultiplier = (regime) => ({
  LOW_VOLATILITY: 0.55,
  NORMAL: 1,
  HIGH_VOLATILITY: 1.75,
  CRASH: 2.5,
  RECOVERY: 1.35,
  NEWS_SHOCK: 2.2,
}[regime] || 1);

const pseudoNoise = (ticker, tick) => {
  let hash = 2166136261;
  for (const char of `${ticker}-${tick}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const a = ((hash >>> 0) % 10000) / 10000;
  const b = (((hash >>> 8) ^ 0x9e3779b9) % 10000) / 10000;
  return Math.sqrt(-2 * Math.log(Math.max(a, 0.0001))) * Math.cos(2 * Math.PI * b);
};

export const calculateNextQuote = ({ profile, previousQuote, marketState, clock, eventImpact }) => {
  const previous = Number(previousQuote?.price || profile.price);
  const sessionMultiplier = {
    OPEN: 1,
    PRE_MARKET: 0.45,
    AFTER_HOURS: 0.35,
    CLOSED: 0,
  }[clock.session] ?? 1;

  const sectorSignal = Number(marketState.sectorSentiments?.[profile.sector] || 0);
  const tickerSignal =
    profile.investorConfidence * 0.2 +
    profile.tradingDemand * 0.2 +
    eventImpact.sentiment * 0.25 +
    profile.innovationPotential * 0.15 +
    eventImpact.demand * 0.15 +
    eventImpact.liquidity * 0.05;
  const combinedSignal =
    marketState.marketSentiment * profile.betaToMarket * 0.45 +
    sectorSignal * 0.25 +
    tickerSignal * 0.3;
  const scaledSignal = Math.tanh(combinedSignal / 50);
  const volatility = volatilityMultiplierFor(profile.baseVolatility) *
    regimeMultiplier(marketState.volatilityRegime) *
    (1 + Math.max(0, eventImpact.volatility) / 80);
  const noise = pseudoNoise(profile.ticker, clock.tick) * 0.0022 * volatility;
  const sessionDrift = clock.session === "CLOSED" ? 0 : scaledSignal * 0.0011 * sessionMultiplier;
  const rawReturn = clamp(sessionDrift + noise * sessionMultiplier, -0.03 * volatility, 0.03 * volatility);
  const close = Math.max(1, previous * (1 + rawReturn));
  const baseSpreadPct = profile.baseSpreadBps / 10000;
  const liquidityPenalty = (100 - profile.liquidityScore + Math.max(0, -eventImpact.liquidity)) / 10000;
  const sessionSpread = clock.session === "OPEN" ? 1 : clock.session === "CLOSED" ? 1.8 : 2.3;
  const spread = Math.max(0.01, close * (baseSpreadPct + liquidityPenalty + volatility * 0.0004) * sessionSpread);
  const volume = Math.max(
    100,
    Math.round(profile.averageVolume * sessionMultiplier * (0.25 + volatility * 0.22 + Math.abs(rawReturn) * 35))
  );

  return {
    price: round(close, 2),
    mid: round(close, 2),
    lastPrice: round(close, 2),
    bid: round(Math.max(0.01, close - spread / 2), 4),
    ask: round(close + spread / 2, 4),
    spread: round(spread, 4),
    volume,
    rawReturn,
    volatilityRegime: marketState.volatilityRegime,
    marketSession: clock.session,
    activeEventCount: eventImpact.count,
  };
};

