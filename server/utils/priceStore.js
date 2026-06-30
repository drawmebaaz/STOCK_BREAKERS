const nowIso = () => new Date().toISOString();
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

export const MOCK_STOCKS = [
  { ticker: "AAPL", name: "Apple Inc.", price: 189.5, sector: "Technology", baseVolatility: 0.012, averageVolume: 1200000, liquidityScore: 0.95 },
  { ticker: "MSFT", name: "Microsoft Corp.", price: 415.2, sector: "Technology", baseVolatility: 0.011, averageVolume: 1050000, liquidityScore: 0.96 },
  { ticker: "GOOGL", name: "Alphabet Inc.", price: 175.8, sector: "Technology", baseVolatility: 0.012, averageVolume: 960000, liquidityScore: 0.92 },
  { ticker: "AMZN", name: "Amazon.com Inc.", price: 195.6, sector: "Consumer", baseVolatility: 0.014, averageVolume: 980000, liquidityScore: 0.9 },
  { ticker: "TSLA", name: "Tesla Inc.", price: 245.1, sector: "Automotive", baseVolatility: 0.026, averageVolume: 1450000, liquidityScore: 0.86 },
  { ticker: "NVDA", name: "NVIDIA Corp.", price: 875.4, sector: "Technology", baseVolatility: 0.024, averageVolume: 1700000, liquidityScore: 0.9 },
  { ticker: "META", name: "Meta Platforms", price: 505.3, sector: "Technology", baseVolatility: 0.015, averageVolume: 840000, liquidityScore: 0.88 },
  { ticker: "JPM", name: "JPMorgan Chase", price: 198.7, sector: "Financials", baseVolatility: 0.009, averageVolume: 720000, liquidityScore: 0.9 },
  { ticker: "JNJ", name: "Johnson & Johnson", price: 152.4, sector: "Healthcare", baseVolatility: 0.007, averageVolume: 560000, liquidityScore: 0.87 },
  { ticker: "V", name: "Visa Inc.", price: 275.9, sector: "Financials", baseVolatility: 0.008, averageVolume: 520000, liquidityScore: 0.91 },
  { ticker: "WMT", name: "Walmart Inc.", price: 68.5, sector: "Consumer", baseVolatility: 0.007, averageVolume: 780000, liquidityScore: 0.88 },
  { ticker: "DIS", name: "Walt Disney Co.", price: 112.3, sector: "Entertainment", baseVolatility: 0.016, averageVolume: 620000, liquidityScore: 0.82 },
  { ticker: "NFLX", name: "Netflix Inc.", price: 635.8, sector: "Entertainment", baseVolatility: 0.02, averageVolume: 680000, liquidityScore: 0.83 },
  { ticker: "COIN", name: "Coinbase Global", price: 225.6, sector: "Financials", baseVolatility: 0.032, averageVolume: 740000, liquidityScore: 0.74 },
  { ticker: "PLTR", name: "Palantir Technologies", price: 24.8, sector: "Technology", baseVolatility: 0.03, averageVolume: 1100000, liquidityScore: 0.76 },
];

const HISTORY_LIMIT = 240;
const marketOpen = new Date();
let tickCount = 0;

const hashTicker = (ticker) =>
  ticker.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);

const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const normalNoise = () => {
  const u = Math.max(Math.random(), 1e-9);
  const v = Math.max(Math.random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const pickRegime = () => {
  const value = Math.random();
  if (value < 0.015) return "NEWS_SHOCK";
  if (value < 0.035) return "HIGH_VOLATILITY";
  if (value < 0.045) return "CRASH";
  if (value < 0.065) return "RECOVERY";
  if (value < 0.18) return "LOW_VOLATILITY";
  return "NORMAL";
};

const regimeMultiplier = (regime) => ({
  LOW_VOLATILITY: 0.55,
  NORMAL: 1,
  HIGH_VOLATILITY: 1.8,
  NEWS_SHOCK: 2.5,
  CRASH: 2.8,
  RECOVERY: 1.5,
}[regime] || 1);

const regimeDrift = (regime) => ({
  CRASH: -0.018,
  RECOVERY: 0.009,
  NEWS_SHOCK: (Math.random() - 0.5) * 0.018,
}[regime] || 0);

const getMarketPhase = () => {
  const elapsedMinutes = Math.floor((Date.now() - marketOpen.getTime()) / 60000);
  const simulatedMinute = elapsedMinutes % 390;
  const enabled = process.env.MARKET_SESSION_ENABLED !== "false";
  return {
    status: enabled ? "OPEN" : "OPEN",
    simulatedMinute,
    label: enabled ? "Open simulated session" : "Always-open demo session",
    updatedAt: nowIso(),
  };
};

const generateInitialHistory = (stock, points = 90) => {
  const rng = seededRandom(hashTicker(stock.ticker));
  let price = stock.price * (0.92 + rng() * 0.16);
  const prices = [];

  for (let index = 0; index < points; index += 1) {
    const cycle = Math.sin(index / 8 + rng() * 0.2) * 0.003;
    const shock = (rng() - 0.5) * stock.baseVolatility;
    price = Math.max(1, price * (1 + cycle + shock));
    prices.push(round(price));
  }

  const scale = stock.price / prices.at(-1);
  return prices.map((value, index) => (index === prices.length - 1 ? stock.price : round(value * scale)));
};

const makeCandle = (stock, close, previousClose, index, regime = "NORMAL") => {
  const open = index === 0 ? previousClose : previousClose;
  const high = Math.max(open, close) * (1 + Math.random() * stock.baseVolatility * 0.35);
  const low = Math.min(open, close) * (1 - Math.random() * stock.baseVolatility * 0.35);
  const volume = Math.max(1000, Math.round(stock.averageVolume * (0.45 + Math.random() * 0.75) * regimeMultiplier(regime)));
  return {
    ticker: stock.ticker,
    timestamp: new Date(Date.now() - (90 - index) * 60000).toISOString(),
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close),
    volume,
    sector: stock.sector,
    regime,
  };
};

let candleHistory = MOCK_STOCKS.reduce((history, stock) => {
  const closes = generateInitialHistory(stock);
  history[stock.ticker] = closes.map((close, index) =>
    makeCandle(stock, close, index === 0 ? close : closes[index - 1], index)
  );
  return history;
}, {});

const quoteFromCandle = (stock, candle, previousClose = stock.price, regime = "NORMAL") => {
  const volatilityPenalty = stock.baseVolatility * regimeMultiplier(regime) * 0.6;
  const lowLiquidityPenalty = (1 - stock.liquidityScore) * 0.004;
  const baseSpreadPct = 0.0004 + volatilityPenalty + lowLiquidityPenalty;
  const spread = Math.max(0.01, candle.close * baseSpreadPct);
  const bid = Math.max(0.01, candle.close - spread / 2);
  const ask = candle.close + spread / 2;
  const day = candleHistory[stock.ticker] || [candle];
  const dayHigh = Math.max(...day.slice(-90).map((item) => item.high));
  const dayLow = Math.min(...day.slice(-90).map((item) => item.low));
  const dayVolume = day.slice(-90).reduce((sum, item) => sum + item.volume, 0);

  return {
    ticker: stock.ticker,
    name: stock.name,
    sector: stock.sector,
    price: round(candle.close),
    lastPrice: round(candle.close),
    mid: round(candle.close),
    bid: round(bid),
    ask: round(ask),
    spread: round(ask - bid, 4),
    volume: candle.volume,
    dayOpen: round(day.at(-90)?.open || previousClose),
    dayHigh: round(dayHigh),
    dayLow: round(dayLow),
    dayVolume,
    previousClose: round(previousClose),
    change: round(((candle.close - previousClose) / previousClose) * 100),
    percentChange: round(((candle.close - previousClose) / previousClose) * 100),
    marketStatus: getMarketPhase().status,
    regime,
    liquidityScore: stock.liquidityScore,
    averageVolume: stock.averageVolume,
    updatedAt: nowIso(),
  };
};

let livePrices = MOCK_STOCKS.map((stock) => {
  const candles = candleHistory[stock.ticker];
  return quoteFromCandle(stock, candles.at(-1), candles.at(-2)?.close || stock.price);
});

const latestRegime = () => livePrices[0]?.regime || "NORMAL";

export const isKnownTicker = (ticker) => MOCK_STOCKS.some((stock) => stock.ticker === ticker);

export const getMarketStatus = () => ({
  ...getMarketPhase(),
  regime: latestRegime(),
  tick: tickCount,
});

export const getLivePrices = () => livePrices;

export const getQuote = (ticker) => livePrices.find((stock) => stock.ticker === ticker) || null;

export const getCandles = (ticker, limit = 120) => {
  const history = candleHistory[ticker];
  if (!history) return null;
  return history.slice(-Math.min(Math.max(Number(limit) || 120, 10), HISTORY_LIMIT));
};

export const updatePrices = () => {
  tickCount += 1;
  const marketStatus = getMarketPhase();
  const regime = pickRegime();
  const marketFactor = normalNoise() * 0.0025 * regimeMultiplier(regime) + regimeDrift(regime);
  const sectors = [...new Set(MOCK_STOCKS.map((stock) => stock.sector))];
  const sectorFactors = sectors.reduce((acc, sector) => {
    acc[sector] = normalNoise() * 0.0018 * regimeMultiplier(regime);
    return acc;
  }, {});

  livePrices = MOCK_STOCKS.map((stock) => {
    const candles = candleHistory[stock.ticker];
    const previous = candles.at(-1);
    const tickerNoise = normalNoise() * stock.baseVolatility * 0.18 * regimeMultiplier(regime);
    const eventShock = regime === "NEWS_SHOCK" && Math.random() < 0.25
      ? normalNoise() * stock.baseVolatility * 1.2
      : 0;
    const nextClose = Math.max(1, previous.close * (1 + marketFactor + sectorFactors[stock.sector] + tickerNoise + eventShock));
    const nextCandle = makeCandle(stock, nextClose, previous.close, tickCount, regime);
    nextCandle.timestamp = nowIso();
    candleHistory[stock.ticker] = [...candles, nextCandle].slice(-HISTORY_LIMIT);
    return {
      ...quoteFromCandle(stock, nextCandle, previous.close, regime),
      marketStatus: marketStatus.status,
    };
  });

  return livePrices;
};

export const getPriceHistory = (ticker, limit = 120) => {
  const candles = getCandles(ticker, limit);
  if (!candles) return null;
  return candles.map((candle) => candle.close);
};

export const getPriceMap = () =>
  livePrices.reduce((acc, stock) => {
    acc[stock.ticker] = stock.price;
    return acc;
  }, {});
