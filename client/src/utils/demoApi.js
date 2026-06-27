const STORAGE_KEY = "stockbreakers-demo-state";
const DEMO_EMAIL = "demo@stockbreakers.local";
const DEMO_PASSWORD = "DemoPass123!";

const STOCKS = [
  { ticker: "AAPL", name: "Apple Inc.", price: 189.5, sector: "Technology", change: 0 },
  { ticker: "MSFT", name: "Microsoft Corp.", price: 415.2, sector: "Technology", change: 0 },
  { ticker: "GOOGL", name: "Alphabet Inc.", price: 175.8, sector: "Technology", change: 0 },
  { ticker: "AMZN", name: "Amazon.com Inc.", price: 195.6, sector: "Consumer", change: 0 },
  { ticker: "TSLA", name: "Tesla Inc.", price: 245.1, sector: "Automotive", change: 0 },
  { ticker: "NVDA", name: "NVIDIA Corp.", price: 875.4, sector: "Technology", change: 0 },
  { ticker: "META", name: "Meta Platforms", price: 505.3, sector: "Technology", change: 0 },
  { ticker: "JPM", name: "JPMorgan Chase", price: 198.7, sector: "Finance", change: 0 },
  { ticker: "JNJ", name: "Johnson & Johnson", price: 152.4, sector: "Healthcare", change: 0 },
  { ticker: "V", name: "Visa Inc.", price: 275.9, sector: "Finance", change: 0 },
  { ticker: "WMT", name: "Walmart Inc.", price: 68.5, sector: "Consumer", change: 0 },
  { ticker: "DIS", name: "Walt Disney Co.", price: 112.3, sector: "Entertainment", change: 0 },
  { ticker: "NFLX", name: "Netflix Inc.", price: 635.8, sector: "Entertainment", change: 0 },
  { ticker: "COIN", name: "Coinbase Global", price: 225.6, sector: "Finance", change: 0 },
  { ticker: "PLTR", name: "Palantir Technologies", price: 24.8, sector: "Technology", change: 0 },
];

let liveStocks = STOCKS.map((stock) => ({ ...stock }));

const clone = (value) => JSON.parse(JSON.stringify(value));
const round = (value, digits = 2) => Number(value.toFixed(digits));

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

const generateHistory = (stock, points = 120) => {
  const rng = seededRandom(hashTicker(stock.ticker));
  const bias = stock.sector === "Technology" ? 0.0008 : stock.sector === "Finance" ? 0.00035 : 0.00015;
  const volatility = stock.price > 500 ? 0.018 : stock.price < 50 ? 0.024 : 0.014;
  let price = stock.price * (0.92 + rng() * 0.16);
  const prices = [];

  for (let index = 0; index < points; index += 1) {
    const cycle = Math.sin(index / 8 + rng() * 0.2) * 0.003;
    const shock = (rng() - 0.5) * volatility;
    price = Math.max(1, price * (1 + bias + cycle + shock));
    prices.push(round(price));
  }

  const scale = stock.price / prices.at(-1);
  return prices.map((value, index) => (index === prices.length - 1 ? stock.price : round(value * scale)));
};

const priceHistory = STOCKS.reduce((history, stock) => {
  history[stock.ticker] = generateHistory(stock);
  return history;
}, {});

const defaultTransactions = () => {
  const now = Date.now();
  return [
    { _id: "demo-txn-005", type: "buy", ticker: "JPM", quantity: 8, price: 192.1, total: 1536.8, createdAt: new Date(now - 2 * 86400000).toISOString() },
    { _id: "demo-txn-004", type: "sell", ticker: "MSFT", quantity: 2, price: 418.2, total: 836.4, createdAt: new Date(now - 4 * 86400000).toISOString() },
    { _id: "demo-txn-003", type: "buy", ticker: "NVDA", quantity: 3, price: 860.5, total: 2581.5, createdAt: new Date(now - 7 * 86400000).toISOString() },
    { _id: "demo-txn-002", type: "buy", ticker: "MSFT", quantity: 4, price: 407.6, total: 1630.4, createdAt: new Date(now - 9 * 86400000).toISOString() },
    { _id: "demo-txn-001", type: "buy", ticker: "AAPL", quantity: 10, price: 184.75, total: 1847.5, createdAt: new Date(now - 12 * 86400000).toISOString() },
  ];
};

const defaultState = () => ({
  token: "demo-static-token",
  password: DEMO_PASSWORD,
  user: {
    id: "demo-user",
    name: "Demo Trader",
    email: DEMO_EMAIL,
    cashBalance: 43240.2,
    watchlist: ["AAPL", "NVDA", "JPM"],
  },
  holdings: [
    { ticker: "AAPL", quantity: 10, avgCost: 184.75, totalInvested: 1847.5 },
    { ticker: "MSFT", quantity: 2, avgCost: 407.6, totalInvested: 815.2 },
    { ticker: "NVDA", quantity: 3, avgCost: 860.5, totalInvested: 2581.5 },
    { ticker: "JPM", quantity: 8, avgCost: 192.1, totalInvested: 1536.8 },
  ],
  transactions: defaultTransactions(),
});

const loadState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch {
    return defaultState();
  }
};

const saveState = (state) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
};

const makeError = (status, message) => {
  const error = new Error(message);
  error.response = { status, data: { error: message } };
  return error;
};

const respond = (data) =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve({ data: clone(data) }), 120);
  });

const fail = (status, message) =>
  new Promise((_, reject) => {
    window.setTimeout(() => reject(makeError(status, message)), 120);
  });

const priceMap = () =>
  liveStocks.reduce((map, stock) => {
    map[stock.ticker] = stock.price;
    return map;
  }, {});

const enrichHoldings = (holdings) => {
  const prices = priceMap();
  return holdings.map((holding) => {
    const currentPrice = prices[holding.ticker] ?? holding.avgCost;
    const currentValue = round(currentPrice * holding.quantity);
    const pnl = round(currentValue - holding.totalInvested);
    const pnlPct = holding.totalInvested > 0 ? round((pnl / holding.totalInvested) * 100) : 0;
    return { ...holding, currentPrice, currentValue, pnl, pnlPct };
  });
};

const portfolioSummary = (state) => {
  const holdings = enrichHoldings(state.holdings);
  const stockValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalInvested = holdings.reduce((sum, holding) => sum + holding.totalInvested, 0);
  const pnl = round(stockValue - totalInvested);
  const pnlPct = totalInvested > 0 ? round((pnl / totalInvested) * 100) : 0;

  return {
    cash: round(state.user.cashBalance),
    stockValue: round(stockValue),
    totalValue: round(state.user.cashBalance + stockValue),
    totalInvested: round(totalInvested),
    pnl,
    pnlPct,
  };
};

const addTransaction = (state, type, ticker, quantity, price, total) => {
  state.transactions.unshift({
    _id: `demo-txn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    ticker,
    quantity,
    price,
    total,
    createdAt: new Date().toISOString(),
  });
};

const updateWatchlist = (ticker, action) => {
  const state = loadState();
  const current = new Set(state.user.watchlist || []);
  if (action === "add") current.add(ticker);
  if (action === "remove") current.delete(ticker);
  state.user.watchlist = Array.from(current);
  saveState(state);
  return { success: true };
};

const handleTrade = (mode, body) => {
  const state = loadState();
  const ticker = String(body?.ticker || "").toUpperCase();
  const quantity = Number(body?.quantity || 0);
  const stock = liveStocks.find((item) => item.ticker === ticker);

  if (!stock) return fail(404, "Stock not found");
  if (!Number.isInteger(quantity) || quantity < 1) return fail(400, "Enter a valid quantity");

  const total = round(stock.price * quantity);
  const holding = state.holdings.find((item) => item.ticker === ticker);

  if (mode === "buy") {
    if (state.user.cashBalance < total) return fail(400, "Insufficient virtual cash");
    state.user.cashBalance = round(state.user.cashBalance - total);

    if (holding) {
      const nextQuantity = holding.quantity + quantity;
      holding.avgCost = round((holding.totalInvested + total) / nextQuantity, 4);
      holding.quantity = nextQuantity;
      holding.totalInvested = round(holding.totalInvested + total);
    } else {
      state.holdings.push({ ticker, quantity, avgCost: stock.price, totalInvested: total });
    }

    addTransaction(state, "buy", ticker, quantity, stock.price, total);
    saveState(state);
    return respond({ success: true, cashBalance: state.user.cashBalance });
  }

  if (!holding || holding.quantity < quantity) return fail(400, "Not enough shares");

  state.user.cashBalance = round(state.user.cashBalance + total);
  holding.quantity -= quantity;
  holding.totalInvested = round(holding.totalInvested - holding.avgCost * quantity);

  if (holding.quantity === 0) {
    state.holdings = state.holdings.filter((item) => item.ticker !== ticker);
  }

  addTransaction(state, "sell", ticker, quantity, stock.price, total);
  saveState(state);
  return respond({ success: true, cashBalance: state.user.cashBalance });
};

const percentile = (values, pct) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * pct;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const weight = index - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
};

const predict = ({ ticker, prices, horizon = 30, simulations = 500 }) => {
  const cleanPrices = prices.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (cleanPrices.length < 10) return fail(400, "Need more price history");

  const start = cleanPrices.at(-1);
  const returns = cleanPrices.slice(1).map((price, index) => Math.log(price / cleanPrices[index]));
  const rng = seededRandom(hashTicker(`${ticker}-${cleanPrices.length}-${horizon}-${simulations}`));
  const runs = Math.min(Math.max(Number(simulations) || 500, 100), 1000);
  const days = Math.min(Math.max(Number(horizon) || 30, 1), 90);
  const paths = [];

  for (let run = 0; run < runs; run += 1) {
    let price = start;
    const path = [];
    for (let day = 0; day < days; day += 1) {
      const sampled = returns[Math.floor(rng() * returns.length)] || 0;
      price = Math.max(1, price * Math.exp(sampled));
      path.push(round(price));
    }
    paths.push(path);
  }

  const forecast = ["p5", "p25", "p50", "p75", "p95"].reduce((acc, key) => {
    const pct = { p5: 0.05, p25: 0.25, p50: 0.5, p75: 0.75, p95: 0.95 }[key];
    acc[key] = Array.from({ length: days }, (_, day) => round(percentile(paths.map((path) => path[day]), pct)));
    return acc;
  }, {});
  const finals = paths.map((path) => path.at(-1));
  const probGain = finals.filter((price) => price > start).length / finals.length;

  return respond({
    ticker,
    S0: round(start),
    horizon: days,
    simulations: runs,
    forecast,
    stats: {
      median_final: round(percentile(finals, 0.5)),
      p5_final: round(percentile(finals, 0.05)),
      p95_final: round(percentile(finals, 0.95)),
      prob_gain: round(probGain * 100, 1),
    },
  });
};

const risk = ({ ticker, prices }) => {
  const cleanPrices = prices.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (cleanPrices.length < 10) return fail(400, "Need more price history");

  const returns = cleanPrices.slice(1).map((price, index) => price / cleanPrices[index] - 1);
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / returns.length;
  const annVol = Math.sqrt(variance) * Math.sqrt(252) * 100;
  let peak = cleanPrices[0];
  let maxDrop = 0;
  cleanPrices.forEach((price) => {
    peak = Math.max(peak, price);
    maxDrop = Math.min(maxDrop, (price - peak) / peak);
  });
  const downside = returns.filter((value) => value < 0).length / returns.length * 100;
  const score = Math.min(95, Math.max(5, annVol * 0.45 + Math.abs(maxDrop) * 100 * 0.35 + downside * 0.2));
  const label = score < 30 ? "Low" : score < 60 ? "Moderate" : "High";
  const color = score < 30 ? "green" : score < 60 ? "amber" : "red";

  return respond({
    ticker,
    score: Math.round(score),
    label,
    color,
    metrics: {
      ann_volatility: round(annVol, 1),
      max_drawdown: round(maxDrop * 100, 1),
      downside_probability: round(downside, 1),
    },
  });
};

const sentiment = ({ ticker }) => {
  const stock = liveStocks.find((item) => item.ticker === ticker);
  const label = stock?.change > 0.35 ? "bullish" : stock?.change < -0.35 ? "bearish" : "neutral";
  const direction = label === "bullish" ? "up" : label === "bearish" ? "down" : "flat";
  const notes = {
    bullish: [
      `${ticker} has been moving up in the recent practice prices`,
      `Check the forecast range before taking a larger practice trade in ${ticker}`,
    ],
    bearish: [
      `${ticker} has been moving down in the recent practice prices`,
      `Consider a smaller practice trade if you choose ${ticker}`,
    ],
    neutral: [
      `${ticker} looks balanced in the recent practice prices`,
      `Use the range view before deciding on ${ticker}`,
    ],
  };

  return respond({ ticker, sentiment: label, direction, confidence: 0.68, headlines: notes[label] });
};

const suggestions = () => {
  const state = loadState();
  const watched = new Set(state.user.watchlist || []);
  const candidates = liveStocks.filter((stock) => !watched.has(stock.ticker));
  const trendingUp = candidates
    .filter((stock) => stock.change >= 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 3)
    .map((stock) => ({ ...stock, rationale: "Recent practice prices are moving up." }));
  const dipBuys = candidates
    .filter((stock) => stock.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 2)
    .map((stock) => ({ ...stock, rationale: "Recent practice prices are down, so review risk carefully." }));

  return respond({ trending_up: trendingUp, dip_buys: dipBuys });
};

const handleGet = (url) => {
  const [path] = url.split("?");
  const state = loadState();

  if (path === "/stocks") return respond({ stocks: liveStocks });
  if (path.startsWith("/stocks/")) {
    const ticker = path.split("/").at(-1).toUpperCase();
    const stock = liveStocks.find((item) => item.ticker === ticker);
    return stock ? respond({ stock }) : fail(404, "Stock not found");
  }
  if (path === "/auth/me") return respond({ user: state.user });
  if (path === "/portfolio") return respond({ holdings: enrichHoldings(state.holdings) });
  if (path === "/portfolio/summary") return respond(portfolioSummary(state));
  if (path === "/transactions") return respond({ transactions: state.transactions });
  if (path.startsWith("/ai/history/")) {
    const ticker = path.split("/").at(-1).toUpperCase();
    const prices = priceHistory[ticker];
    if (!prices) return fail(404, "Stock history not found");
    return respond({
      ticker,
      prices,
      points: prices.length,
      currentPrice: liveStocks.find((stock) => stock.ticker === ticker)?.price,
      source: "browser-demo",
    });
  }
  if (path === "/ai/suggestions") return suggestions();

  return fail(404, "Demo route not found");
};

const handlePost = (url, body = {}) => {
  if (url === "/auth/login") {
    const state = loadState();
    const email = String(body.email || "").trim().toLowerCase();
    if (email !== state.user.email || body.password !== state.password) {
      return fail(401, "Invalid credentials");
    }
    return respond({ token: state.token, user: state.user });
  }

  if (url === "/auth/register") {
    const nextState = defaultState();
    nextState.user.name = body.name || "Demo Trader";
    nextState.user.email = String(body.email || DEMO_EMAIL).trim().toLowerCase();
    nextState.password = body.password || DEMO_PASSWORD;
    saveState(nextState);
    return respond({ token: nextState.token, user: nextState.user });
  }

  if (url === "/watchlist/add") return respond(updateWatchlist(String(body.ticker || "").toUpperCase(), "add"));
  if (url === "/watchlist/remove") return respond(updateWatchlist(String(body.ticker || "").toUpperCase(), "remove"));
  if (url === "/trade/buy") return handleTrade("buy", body);
  if (url === "/trade/sell") return handleTrade("sell", body);
  if (url === "/ai/predict") return predict(body);
  if (url === "/ai/sentiment") return sentiment(body);
  if (url === "/ai/risk") return risk(body);

  return fail(404, "Demo route not found");
};

const listeners = new Map();
let intervalId = null;
let connected = false;

const emit = (event, payload) => {
  const handlers = listeners.get(event);
  if (!handlers) return;
  handlers.forEach((handler) => handler(payload));
};

const stepPrices = () => {
  liveStocks = liveStocks.map((stock) => {
    const drift = (Math.random() - 0.48) * 0.018;
    const newPrice = round(stock.price * (1 + drift));
    const change = round(((newPrice - stock.price) / stock.price) * 100);
    const history = priceHistory[stock.ticker] || [stock.price];
    priceHistory[stock.ticker] = [...history, newPrice].slice(-240);
    return { ...stock, price: newPrice, change };
  });
  emit("price_update", clone(liveStocks));
};

export const demoSocket = {
  connect() {
    if (connected) return;
    connected = true;
    window.setTimeout(() => {
      emit("connect");
      emit("price_update", clone(liveStocks));
    }, 0);
    intervalId = window.setInterval(stepPrices, 4500);
  },
  disconnect() {
    connected = false;
    if (intervalId) window.clearInterval(intervalId);
    intervalId = null;
    emit("disconnect");
  },
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
  },
  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },
};

export const createDemoApi = () => ({
  get: handleGet,
  post: handlePost,
});

export { DEMO_EMAIL, DEMO_PASSWORD };
