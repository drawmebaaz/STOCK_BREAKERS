import { getBenchmarkIndex, getBenchmarkIndexes, updateBenchmarkIndexes } from "./benchmarkIndexes.js";
import { getCandlesForTicker, getCandleCount, getDayStats, getPriceHistoryFromCandles, initializeCandles, updateCandle } from "./candleStore.js";
import { getActiveEvents, getEventImpactFor, tickEventEngine } from "./eventEngine.js";
import { calculateNextQuote } from "./factorPricingEngine.js";
import { getInstrumentProfile, instrumentProfiles } from "./instrumentProfiles.js";
import { advanceMarketClock, getMarketClockStatus } from "./marketClock.js";
import { getMarketState, updateMarketState } from "./marketState.js";

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

export const MOCK_STOCKS = instrumentProfiles.map((profile) => ({
  ticker: profile.ticker,
  name: profile.name,
  companyName: profile.companyName,
  price: profile.price,
  sector: profile.sector,
  baseVolatility: profile.baseVolatility,
  averageVolume: profile.averageVolume,
  liquidityScore: profile.liquidityScore / 100,
}));

initializeCandles(instrumentProfiles);

let livePrices = [];
let lastClock = getMarketClockStatus();
let lastMarketState = getMarketState();

const buildQuote = (profile, quoteCore, previousQuote, clock, marketState, activeEventSummary = null) => {
  const day = getDayStats(profile.ticker);
  const previousPrice = previousQuote?.price || profile.price;
  const dayOpen = Number(day.dayOpen || previousPrice);
  const dayChange = dayOpen > 0 ? ((quoteCore.price - dayOpen) / dayOpen) * 100 : 0;
  const lastTickChange = previousPrice > 0 ? ((quoteCore.price - previousPrice) / previousPrice) * 100 : 0;
  const liquidityScore = Math.max(0.1, Math.min(0.99, (profile.liquidityScore + Number(quoteCore.eventLiquidityAdjustment || 0)) / 100));

  return {
    ticker: profile.ticker,
    name: profile.name,
    companyName: profile.companyName,
    sector: profile.sector,
    industry: profile.industry,
    marketCapBucket: profile.marketCapBucket,
    style: profile.style,
    price: round(quoteCore.price),
    lastPrice: round(quoteCore.price),
    mid: round(quoteCore.mid),
    bid: round(quoteCore.bid, 4),
    ask: round(quoteCore.ask, 4),
    spread: round(quoteCore.spread, 4),
    volume: quoteCore.volume,
    dayOpen: round(dayOpen),
    dayHigh: round(day.dayHigh || quoteCore.price),
    dayLow: round(day.dayLow || quoteCore.price),
    dayVolume: day.dayVolume || quoteCore.volume,
    previousClose: round(previousPrice),
    change: round(dayChange, 2),
    percentChange: round(dayChange, 2),
    lastTickChangePercent: round(lastTickChange, 3),
    marketStatus: clock.session,
    marketSession: clock.session,
    regime: marketState.volatilityRegime,
    volatilityRegime: marketState.volatilityRegime,
    liquidityScore,
    averageVolume: profile.averageVolume,
    baseSpreadBps: profile.baseSpreadBps,
    activeEventCount: quoteCore.activeEventCount || 0,
    activeEventSummary,
    updatedAt: new Date().toISOString(),
  };
};

const initialQuotes = () => {
  const clock = getMarketClockStatus();
  const marketState = getMarketState();
  livePrices = instrumentProfiles.map((profile) => {
    const candles = getCandlesForTicker(profile.ticker, 2);
    const price = candles?.at(-1)?.close || profile.price;
    const quoteCore = {
      price,
      mid: price,
      bid: price * (1 - profile.baseSpreadBps / 20000),
      ask: price * (1 + profile.baseSpreadBps / 20000),
      spread: price * (profile.baseSpreadBps / 10000),
      volume: Math.round(profile.averageVolume * 0.2),
      activeEventCount: 0,
    };
    return buildQuote(profile, quoteCore, { price }, clock, marketState);
  });
  updateBenchmarkIndexes({ profiles: instrumentProfiles, quotes: livePrices, clock });
};

initialQuotes();

export const isKnownTicker = (ticker) => Boolean(getInstrumentProfile(ticker));

export const getMarketStatus = () => ({
  ...lastClock,
  regime: lastMarketState.volatilityRegime,
  volatilityRegime: lastMarketState.volatilityRegime,
  marketSentiment: round(lastMarketState.marketSentiment, 2),
  marketTrend: round(lastMarketState.marketTrend, 2),
  activeEvents: getActiveEvents().slice(0, 5),
});

export const getLivePrices = () => livePrices;

export const getQuote = (ticker) => livePrices.find((stock) => stock.ticker === String(ticker || "").toUpperCase()) || null;

export const getCandles = (ticker, limit = 120) => getCandlesForTicker(String(ticker || "").toUpperCase(), limit);

export const getPriceHistory = (ticker, limit = 120) => getPriceHistoryFromCandles(String(ticker || "").toUpperCase(), limit);

export const getPriceMap = () =>
  livePrices.reduce((acc, stock) => {
    acc[stock.ticker] = stock.price;
    return acc;
  }, {});

export const getMarketEvents = (filters = {}) => getActiveEvents(filters);

export const getIndexes = () => getBenchmarkIndexes();

export const getIndex = (symbol) => getBenchmarkIndex(symbol);

export const getEngineSnapshot = () => ({
  market: getMarketStatus(),
  state: lastMarketState,
  events: getActiveEvents(),
  indexes: getBenchmarkIndexes(),
  candleCount: getCandleCount(),
});

export const updatePrices = () => {
  lastClock = advanceMarketClock();
  let activeEvents = getActiveEvents();
  lastMarketState = updateMarketState({ clock: lastClock, activeEvents });
  activeEvents = tickEventEngine(lastClock, lastMarketState);
  lastMarketState = updateMarketState({ clock: lastClock, activeEvents });

  livePrices = instrumentProfiles.map((profile) => {
    const previous = getQuote(profile.ticker) || { price: profile.price };
    const eventImpact = getEventImpactFor(profile);
    const quoteCore = calculateNextQuote({
      profile,
      previousQuote: previous,
      marketState: lastMarketState,
      clock: lastClock,
      eventImpact,
    });
    updateCandle({
      ticker: profile.ticker,
      quote: quoteCore,
      clock: lastClock,
      regime: lastMarketState.volatilityRegime,
    });
    const eventSummary = getActiveEvents({ ticker: profile.ticker })[0]?.headline || null;
    return buildQuote(profile, quoteCore, previous, lastClock, lastMarketState, eventSummary);
  });

  updateBenchmarkIndexes({ profiles: instrumentProfiles, quotes: livePrices, clock: lastClock });
  return livePrices;
};

export const availableStocksWithQuotes = () => getLivePrices();
