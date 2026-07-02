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
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const hashTicker = (ticker) =>
  ticker.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);

const demoTokenFor = (email) => `demo-static-token-${hashTicker(email).toString(36)}`;
const userIdFor = (email) => `demo-user-${hashTicker(email).toString(36)}`;

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

const withQuote = (stock) => {
  const history = priceHistory[stock.ticker] || [stock.price];
  const spread = Math.max(0.01, stock.price * (stock.ticker === "COIN" || stock.ticker === "PLTR" ? 0.003 : 0.0012));
  const volume = Math.round(400000 + hashTicker(`${stock.ticker}-${history.length}`) % 900000);
  return {
    ...stock,
    mid: stock.price,
    lastPrice: stock.price,
    bid: round(stock.price - spread / 2, 4),
    ask: round(stock.price + spread / 2, 4),
    spread: round(spread, 4),
    volume,
    dayOpen: history.at(-30) || history[0] || stock.price,
    dayHigh: round(Math.max(...history.slice(-90))),
    dayLow: round(Math.min(...history.slice(-90))),
    dayVolume: volume * 90,
    marketStatus: "OPEN",
    marketSession: "OPEN",
    regime: "NORMAL",
    volatilityRegime: "NORMAL",
    activeEventCount: 0,
    activeEventSummary: null,
    liquidityScore: stock.ticker === "COIN" || stock.ticker === "PLTR" ? 0.76 : 0.9,
    averageVolume: volume,
    updatedAt: new Date().toISOString(),
  };
};

liveStocks = liveStocks.map(withQuote);

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

const defaultRiskSettings = () => ({
  maxRiskPerTradePercent: 2,
  maxPortfolioRiskPercent: 6,
  maxTickerExposurePercent: 25,
  maxSectorExposurePercent: 40,
  defaultStopLossPercent: 5,
  requireTradePlan: true,
  warnOnOversizing: true,
});

const seededDemoAccount = () => ({
  token: demoTokenFor(DEMO_EMAIL),
  password: DEMO_PASSWORD,
  user: {
    id: userIdFor(DEMO_EMAIL),
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
  orders: [],
  riskSettings: defaultRiskSettings(),
});

const emptyAccount = ({ name, email, password }) => {
  const safeEmail = normalizeEmail(email);

  return {
    token: demoTokenFor(safeEmail),
    password,
    user: {
      id: userIdFor(safeEmail),
      name: name || "Practice Trader",
      email: safeEmail,
      cashBalance: 50000,
      watchlist: [],
    },
    holdings: [],
    transactions: [],
    orders: [],
    riskSettings: defaultRiskSettings(),
  };
};

const defaultStore = () => ({
  activeEmail: DEMO_EMAIL,
  accounts: {
    [DEMO_EMAIL]: seededDemoAccount(),
  },
});

const defaultState = () => seededDemoAccount();

const accountFromLegacyState = (state) => {
  const fallback = seededDemoAccount();
  const user = state?.user || fallback.user;
  const email = normalizeEmail(user.email || DEMO_EMAIL);

  return {
    ...fallback,
    ...state,
    token: demoTokenFor(email),
    password: state?.password || (email === DEMO_EMAIL ? DEMO_PASSWORD : ""),
    user: {
      ...fallback.user,
      ...user,
      id: user.id || userIdFor(email),
      email,
    },
    holdings: Array.isArray(state?.holdings) ? state.holdings : [],
    transactions: Array.isArray(state?.transactions) ? state.transactions : [],
    orders: Array.isArray(state?.orders) ? state.orders : [],
    riskSettings: state?.riskSettings || defaultRiskSettings(),
  };
};

const normalizeStore = (rawState) => {
  if (!rawState || typeof rawState !== "object") return defaultStore();

  if (!rawState.accounts) {
    const account = accountFromLegacyState(rawState);
    return {
      activeEmail: account.user.email,
      accounts: {
        [DEMO_EMAIL]: seededDemoAccount(),
        [account.user.email]: account,
      },
    };
  }

  const accounts = Object.entries(rawState.accounts).reduce((acc, [email, account]) => {
    const normalized = accountFromLegacyState(account);
    acc[normalizeEmail(email || normalized.user.email)] = normalized;
    return acc;
  }, {});

  accounts[DEMO_EMAIL] = accounts[DEMO_EMAIL] || seededDemoAccount();

  const activeEmail = normalizeEmail(rawState.activeEmail);
  return {
    activeEmail: accounts[activeEmail] ? activeEmail : DEMO_EMAIL,
    accounts,
  };
};

const loadStore = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const store = normalizeStore(raw ? JSON.parse(raw) : null);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return store;
  } catch {
    const store = defaultStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return store;
  }
};

const saveStore = (store) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
};

const loadState = () => {
  const store = loadStore();
  return store.accounts[store.activeEmail] || store.accounts[DEMO_EMAIL] || defaultState();
};

const saveState = (state) => {
  const store = loadStore();
  const email = normalizeEmail(state.user.email);
  state.user.email = email;
  state.user.id = state.user.id || userIdFor(email);
  state.token = state.token || demoTokenFor(email);
  store.activeEmail = email;
  store.accounts[email] = state;
  saveStore(store);
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
    const reservedQuantity = Number(holding.reservedQuantity || 0);
    return { ...holding, reservedQuantity, availableQuantity: Math.max(0, Number(holding.quantity || 0) - reservedQuantity), currentPrice, currentValue, pnl, pnlPct };
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
    reservedCash: round(state.user.reservedCash || 0),
    availableCash: round(Math.max(0, Number(state.user.cashBalance || 0) - Number(state.user.reservedCash || 0))),
    stockValue: round(stockValue),
    totalValue: round(state.user.cashBalance + stockValue),
    totalInvested: round(totalInvested),
    pnl,
    pnlPct,
  };
};

const addTransaction = (state, type, ticker, quantity, price, total, extra = {}) => {
  const transaction = {
    _id: `demo-txn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    ticker,
    quantity,
    price,
    total,
    filledQuantity: quantity,
    fillPrice: price,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  state.transactions.unshift(transaction);
  return transaction;
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

const orderStatusFromLimit = ({ side, type, limitPrice, stock }) => {
  if (type !== "LIMIT") return "FILL";
  if (side === "BUY") return stock.ask <= Number(limitPrice) ? "FILL" : "PENDING";
  return stock.bid >= Number(limitPrice) ? "FILL" : "PENDING";
};

const handleOrder = (body = {}) => {
  const state = loadState();
  const ticker = String(body.ticker || "").toUpperCase();
  const side = String(body.side || "BUY").toUpperCase();
  const type = String(body.type || "MARKET").toUpperCase();
  const quantity = Number(body.quantity || 0);
  const idempotencyKey = String(body.idempotencyKey || "");
  const stock = liveStocks.find((item) => item.ticker === ticker);

  if (!stock) return fail(404, "Stock not found");
  if (!Number.isInteger(quantity) || quantity < 1) return fail(400, "Enter a valid quantity");
  if (!idempotencyKey) return fail(400, "Order key is required");

  const existing = state.orders.find((order) => order.idempotencyKey === idempotencyKey);
  if (existing) return respond({ success: existing.status !== "REJECTED", order: existing, idempotent: true });

  const limitPrice = type === "LIMIT" ? Number(body.limitPrice || 0) : null;
  if (type === "LIMIT" && !limitPrice) return fail(400, "Limit price is required");

  const fillCheck = orderStatusFromLimit({ side, type, limitPrice, stock });
  const availableCash = Math.max(0, Number(state.user.cashBalance || 0) - Number(state.user.reservedCash || 0));
  const availableShares = (holding) => Math.max(0, Number(holding?.quantity || 0) - Number(holding?.reservedQuantity || 0));
  const estimatedSlippage = round(stock.price * (1 - stock.liquidityScore) * 0.001, 4);
  const pendingCashReservation = type === "LIMIT" && side === "BUY" && fillCheck !== "FILL"
    ? round(limitPrice * quantity + Math.abs(estimatedSlippage) * quantity)
    : 0;
  const pendingShareReservation = type === "LIMIT" && side === "SELL" && fillCheck !== "FILL" ? quantity : 0;

  if (pendingCashReservation > availableCash) return fail(400, "Insufficient available virtual cash for this pending limit order");
  if (pendingShareReservation > 0) {
    const holding = state.holdings.find((item) => item.ticker === ticker);
    if (!holding || availableShares(holding) < quantity) return fail(400, "Not enough available shares to reserve for this pending limit order");
  }

  const order = {
    _id: `demo-order-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ticker,
    side,
    type,
    quantity,
    limitPrice,
    status: fillCheck === "FILL" ? "FILLED" : "PENDING",
    requestedPrice: stock.mid,
    requestedBid: stock.bid,
    requestedAsk: stock.ask,
    avgFillPrice: 0,
    filledQuantity: 0,
    remainingQuantity: quantity,
    estimatedSlippage,
    actualSlippage: 0,
    spreadPaid: 0,
    reservedCashAmount: pendingCashReservation,
    reservedShareQuantity: pendingShareReservation,
    reservationStatus: pendingCashReservation > 0 || pendingShareReservation > 0 ? "RESERVED" : "NONE",
    reservationCreatedAt: pendingCashReservation > 0 || pendingShareReservation > 0 ? new Date().toISOString() : null,
    reservationReleasedAt: null,
    rejectionReason: null,
    idempotencyKey,
    tradePlanId: body.tradePlan ? `demo-plan-${Date.now()}` : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canCancel: fillCheck !== "FILL",
  };

  if (fillCheck !== "FILL") {
    if (pendingCashReservation > 0) state.user.reservedCash = round(Number(state.user.reservedCash || 0) + pendingCashReservation);
    if (pendingShareReservation > 0) {
      const holding = state.holdings.find((item) => item.ticker === ticker);
      holding.reservedQuantity = Number(holding.reservedQuantity || 0) + pendingShareReservation;
    }
    state.orders.unshift(order);
    saveState(state);
    return respond({ success: true, order, snapshot: portfolioSummary(state) });
  }

  const slippage = Math.abs(order.estimatedSlippage);
  const fillPrice = side === "BUY" ? round(stock.ask + slippage, 4) : round(stock.bid - slippage, 4);
  const total = round(fillPrice * quantity);
  const holding = state.holdings.find((item) => item.ticker === ticker);

  if (side === "BUY") {
    if (Math.max(0, Number(state.user.cashBalance || 0) - Number(state.user.reservedCash || 0)) < total) {
      order.status = "REJECTED";
      order.rejectionReason = "Insufficient virtual cash for this order";
      state.orders.unshift(order);
      saveState(state);
      return respond({ success: false, order, snapshot: portfolioSummary(state) });
    }
    state.user.cashBalance = round(state.user.cashBalance - total);
    if (holding) {
      const nextQuantity = holding.quantity + quantity;
      holding.avgCost = round((holding.totalInvested + total) / nextQuantity, 4);
      holding.quantity = nextQuantity;
      holding.totalInvested = round(holding.totalInvested + total);
    } else {
      state.holdings.push({ ticker, quantity, avgCost: fillPrice, totalInvested: total });
    }
  } else {
    if (!holding || availableShares(holding) < quantity) {
      order.status = "REJECTED";
      order.rejectionReason = "Not enough shares available to sell";
      state.orders.unshift(order);
      saveState(state);
      return respond({ success: false, order, snapshot: portfolioSummary(state) });
    }
    state.user.cashBalance = round(state.user.cashBalance + total);
    const realizedPnl = round((fillPrice - holding.avgCost) * quantity);
    holding.quantity -= quantity;
    holding.totalInvested = round(holding.totalInvested - holding.avgCost * quantity);
    if (holding.quantity === 0) state.holdings = state.holdings.filter((item) => item.ticker !== ticker);
    order.realizedPnl = realizedPnl;
  }

  order.status = "FILLED";
  order.filledQuantity = quantity;
  order.remainingQuantity = 0;
  order.avgFillPrice = fillPrice;
  order.actualSlippage = round(slippage * quantity, 4);
  order.spreadPaid = round(stock.spread * quantity, 4);
  order.filledAt = new Date().toISOString();
  order.canCancel = false;
  const transaction = addTransaction(state, side.toLowerCase(), ticker, quantity, fillPrice, total, {
    orderId: order._id,
    side,
    orderType: type,
    bid: stock.bid,
    ask: stock.ask,
    slippage: order.actualSlippage,
    spreadPaid: order.spreadPaid,
    realizedPnl: side === "SELL" ? order.realizedPnl : null,
    positionAfter: side === "BUY" ? (holding?.quantity || quantity) : Math.max(0, holding?.quantity || 0),
  });
  state.orders.unshift(order);
  saveState(state);
  return respond({ success: true, order, transaction, snapshot: portfolioSummary(state) });
};

const cancelDemoOrder = (orderId) => {
  const state = loadState();
  const order = state.orders.find((item) => item._id === orderId);
  if (!order) return fail(404, "Order not found");
  if (!["PENDING", "PARTIALLY_FILLED"].includes(order.status)) return fail(400, "Only pending orders can be cancelled");
  order.status = "CANCELLED";
  order.cancelledAt = new Date().toISOString();
  order.canCancel = false;
  if (Number(order.reservedCashAmount || 0) > 0) {
    state.user.reservedCash = round(Math.max(0, Number(state.user.reservedCash || 0) - Number(order.reservedCashAmount || 0)));
    order.reservedCashAmount = 0;
  }
  if (Number(order.reservedShareQuantity || 0) > 0) {
    const holding = state.holdings.find((item) => item.ticker === order.ticker);
    if (holding) holding.reservedQuantity = Math.max(0, Number(holding.reservedQuantity || 0) - Number(order.reservedShareQuantity || 0));
    order.reservedShareQuantity = 0;
  }
  if (order.reservationStatus === "RESERVED") {
    order.reservationStatus = "RELEASED";
    order.reservationReleasedAt = new Date().toISOString();
  }
  saveState(state);
  return respond({ success: true, order });
};

const portfolioAnalytics = (state) => {
  const holdings = enrichHoldings(state.holdings);
  const summary = portfolioSummary(state);
  const sells = state.transactions.filter((txn) => txn.type === "sell");
  const rMultiples = sells.map((txn) => txn.realizedR).filter((value) => value !== null && value !== undefined);
  const realizedPnl = sells.reduce((sum, txn) => sum + Number(txn.realizedPnl || 0), 0);
  const wins = sells.filter((txn) => Number(txn.realizedPnl || 0) > 0);
  const losses = sells.filter((txn) => Number(txn.realizedPnl || 0) < 0);
  const sectorExposure = holdings.reduce((acc, holding) => {
    const sector = liveStocks.find((stock) => stock.ticker === holding.ticker)?.sector || "Unclassified";
    acc[sector] = acc[sector] || { sector, value: 0 };
    acc[sector].value += holding.currentValue;
    return acc;
  }, {});

  return {
    totalEquity: summary.totalValue,
    cash: summary.cash,
    marketValue: summary.stockValue,
    realizedPnl: round(realizedPnl),
    unrealizedPnl: summary.pnl,
    totalPnl: round(realizedPnl + summary.pnl),
    winRate: sells.length ? round((wins.length / sells.length) * 100) : 0,
    averageWin: wins.length ? round(wins.reduce((sum, txn) => sum + txn.realizedPnl, 0) / wins.length) : 0,
    averageLoss: losses.length ? round(losses.reduce((sum, txn) => sum + txn.realizedPnl, 0) / losses.length) : 0,
    profitFactor: 0,
    maxDrawdown: 0,
    openRiskAmount: 0,
    openRiskPercent: 0,
    rMultipleCount: rMultiples.length,
    averageRMultiple: rMultiples.length ? round(rMultiples.reduce((sum, value) => sum + Number(value || 0), 0) / rMultiples.length) : 0,
    tickerConcentration: holdings.map((holding) => ({
      ticker: holding.ticker,
      value: holding.currentValue,
      weight: summary.totalValue ? round((holding.currentValue / summary.totalValue) * 100) : 0,
      warning: false,
    })),
    sectorExposure: Object.values(sectorExposure).map((item) => ({
      ...item,
      value: round(item.value),
      weight: summary.totalValue ? round((item.value / summary.totalValue) * 100) : 0,
      warning: false,
    })),
    totalTrades: state.transactions.length,
    realizedTradeCount: sells.length,
    plannedTradesCount: state.orders.filter((order) => order.tradePlanId).length,
    followedPlanRate: 0,
    riskWarnings: [],
  };
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

const demoMarketStatus = () => ({
  session: "OPEN",
  status: "OPEN",
  isOpen: true,
  allowsMarketOrders: true,
  simulatedDate: "2026-07-01",
  simulatedTime: "10:35",
  tick: priceHistory.AAPL?.length || 120,
  minutesPerTick: 5,
  nextEvent: "MARKET_CLOSE",
  nextEventInSimMinutes: 325,
  volatilityRegime: "NORMAL",
  regime: "NORMAL",
  label: "Open simulated session",
});

const demoEvents = () => [
  {
    id: "demo-event-1",
    type: "MARKET_NEWS",
    scope: "MARKET",
    headline: "Simulated Event: practice-market demand is steady",
    description: "Browser demo event only. No real news is used.",
    severity: "LOW",
    currentImpact: { sentiment: 4, demand: 3, liquidity: 0, volatility: 1 },
  },
];

const demoIndexes = () => {
  const total = liveStocks.reduce((sum, stock) => sum + stock.price, 0) / liveStocks.length;
  const sectors = [...new Set(liveStocks.map((stock) => stock.sector))];
  return [
    {
      symbol: "SBX_TOTAL",
      name: "StockBreakers Total Market",
      members: liveStocks.map((stock) => stock.ticker),
      currentValue: round(total),
      dayOpen: round(total * 0.997),
      dayChangePercent: 0.3,
      history: [],
    },
    ...sectors.map((sector) => {
      const members = liveStocks.filter((stock) => stock.sector === sector);
      const value = members.reduce((sum, stock) => sum + stock.price, 0) / members.length;
      return {
        symbol: `SBX_${sector.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)}`,
        name: `${sector} Benchmark`,
        sector,
        members: members.map((stock) => stock.ticker),
        currentValue: round(value),
        dayOpen: round(value * 0.998),
        dayChangePercent: 0.2,
        history: [],
      };
    }),
  ];
};

const handleGet = (url) => {
  const [path, queryString = ""] = url.split("?");
  const query = new URLSearchParams(queryString);
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
  if (path === "/portfolio/analytics") return respond(portfolioAnalytics(state));
  if (path === "/transactions") return respond({ transactions: state.transactions });
  if (path === "/orders") {
    const status = query.get("status");
    const orders = status ? state.orders.filter((order) => order.status === status) : state.orders;
    return respond({ orders, page: 1, limit: 50 });
  }
  if (path === "/risk/settings") return respond({ settings: state.riskSettings || defaultRiskSettings() });
  if (path === "/market/status") return respond({ market: demoMarketStatus() });
  if (path === "/market/events") return respond({ events: demoEvents(), simulationNotice: "These are generated simulation events, not real news." });
  if (path === "/market/indexes") return respond({ indexes: demoIndexes(), simulationNotice: "Simulated benchmark indexes for practice comparison." });
  if (path.startsWith("/market/indexes/")) {
    const symbol = path.split("/").at(-1).toUpperCase();
    const index = demoIndexes().find((item) => item.symbol === symbol);
    return index ? respond({ index }) : fail(404, "Benchmark index not found");
  }
  if (path.startsWith("/market/candles/")) {
    const ticker = path.split("/").at(-1).toUpperCase();
    const prices = priceHistory[ticker];
    if (!prices) return fail(404, "Market data not found");
    return respond({
      ticker,
      range: query.get("range") || "1D",
      interval: query.get("interval") || "5m",
      candles: prices.slice(-120).map((price, index) => ({
        ticker,
        timestamp: new Date(Date.now() - (120 - index) * 60000).toISOString(),
        simulatedDate: "2026-07-01",
        simulatedTime: "10:35",
        session: "OPEN",
        open: price,
        high: round(price * 1.002),
        low: round(price * 0.998),
        close: price,
        volume: 100000,
        regime: "NORMAL",
      })),
      quote: liveStocks.find((stock) => stock.ticker === ticker),
      market: demoMarketStatus(),
    });
  }
  if (path.startsWith("/ai/history/")) {
    const ticker = path.split("/").at(-1).toUpperCase();
    const prices = priceHistory[ticker];
    if (!prices) return fail(404, "Stock history not found");
    return respond({
      ticker,
      prices,
      points: prices.length,
      currentPrice: liveStocks.find((stock) => stock.ticker === ticker)?.price,
      marketStatus: demoMarketStatus(),
      activeEvents: demoEvents(),
      benchmark: demoIndexes()[0],
      source: "browser-demo",
    });
  }
  if (path === "/ai/suggestions") return suggestions();
  if (path === "/discipline/summary") {
    const filled = state.orders.filter((order) => ["FILLED", "PARTIALLY_FILLED"].includes(order.status));
    const planned = filled.filter((order) => order.tradePlanId).length;
    const unplanned = Math.max(0, filled.length - planned);
    const planning = filled.length ? Math.max(0, 1 - unplanned / filled.length) : 0;
    const risk = filled.length ? planned / filled.length : 0;
    const sizing = 1;
    const review = 0;
    const behavior = 1;
    const score = filled.length
      ? Math.round((planning * 0.3 + risk * 0.3 + sizing * 0.15 + review * 0.15 + behavior * 0.1) * 100)
      : null;
    return respond({
      totalTrades: filled.length,
      plannedTrades: planned,
      unplannedTrades: unplanned,
      planAdherenceRate: filled.length ? round((planned / filled.length) * 100) : 0,
      tradesWithStopLoss: planned,
      tradesWithTarget: planned,
      averageRewardRisk: 0,
      averageRMultiple: 0,
      oversizedTrades: 0,
      overSizedTrades: 0,
      revengeTradeSignals: 0,
      earlyExitCount: 0,
      lateExitCount: 0,
      noThesisTrades: unplanned,
      biggestBehaviorLeak: unplanned ? "Planning gap" : "No clear leak yet",
      weeklyDisciplineScore: score,
      scoreLabel: score === null ? "Not enough data" : score >= 80 ? "Strong routine" : score >= 60 ? "Mostly controlled" : score >= 40 ? "Needs structure" : "High-risk habits",
      scoreConfidence: filled.length >= 8 ? "MEDIUM" : "LOW",
      scoreExplanation: score === null
        ? "Place a few practice orders with a written plan before judging discipline."
        : "Demo mode scores the visible practice habits from browser-stored orders.",
      scoreBreakdown: {
        planning: round(planning * 100),
        risk: round(risk * 100),
        sizing: round(sizing * 100),
        review: round(review * 100),
        behavior: round(behavior * 100),
        weights: { planning: 0.3, risk: 0.3, sizing: 0.15, review: 0.15, behavior: 0.1 },
      },
      improvementTrend: "Demo mode keeps this simple.",
      followedPlanRate: 0,
      reviewedTrades: 0,
      recommendationCards: [
        { id: "demo-1", text: "Use the risk plan on each practice order so your history becomes useful." },
        { id: "demo-2", text: "Add stop-loss and target prices before taking larger simulated positions." },
      ],
      nextTradeChecklist: [
        "Write the entry reason in one plain sentence.",
        "Set the price that would prove the trade wrong.",
        "Keep the planned loss small compared with your account.",
      ],
      recentReviews: [],
      setupPerformance: [],
    });
  }

  return fail(404, "Demo route not found");
};

const handlePost = (url, body = {}) => {
  if (url === "/auth/login") {
    const store = loadStore();
    const email = normalizeEmail(body.email);
    const account = store.accounts[email];

    if (!account) {
      return fail(401, "Invalid credentials");
    }
    if (!account.password) return fail(401, "Invalid credentials");
    if (body.password !== account.password) return fail(401, "Invalid credentials");

    store.activeEmail = email;
    saveStore(store);
    return respond({ token: account.token, user: account.user });
  }

  if (url === "/auth/register") {
    const store = loadStore();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email) return fail(400, "Email is required");
    if (password.length < 8) return fail(400, "Password must be at least 8 characters");
    if (store.accounts[email]) return fail(409, "Email already in use");

    const account = emptyAccount({
      name: body.name || "Practice Trader",
      email,
      password,
    });

    store.activeEmail = email;
    store.accounts[email] = account;
    saveStore(store);
    return respond({ token: account.token, user: account.user });
  }

  if (url === "/watchlist/add") return respond(updateWatchlist(String(body.ticker || "").toUpperCase(), "add"));
  if (url === "/watchlist/remove") return respond(updateWatchlist(String(body.ticker || "").toUpperCase(), "remove"));
  if (url === "/trade/buy") return handleTrade("buy", body);
  if (url === "/trade/sell") return handleTrade("sell", body);
  if (url === "/orders") return handleOrder(body);
  if (url.startsWith("/orders/") && url.endsWith("/cancel")) {
    return cancelDemoOrder(url.split("/")[2]);
  }
  if (url === "/ai/predict") return predict(body);
  if (url === "/ai/scenario") return predict(body).then((res) => ({
    data: {
      ...res.data,
      status: "ok",
      marketContext: {
        session: "OPEN",
        simulatedTime: "10:35",
        volatilityRegime: "NORMAL",
        activeEvents: demoEvents(),
        benchmark: demoIndexes()[0],
      },
      scenario: {
        worstCase: res.data.stats.p5_final,
        baseCase: res.data.stats.median_final,
        bestCase: res.data.stats.p95_final,
        gainProbability: res.data.stats.prob_gain,
        plainEnglishRiskSummary: "Demo scenario based on browser-stored simulated price history.",
      },
    },
  }));
  if (url === "/ai/sentiment") return sentiment(body);
  if (url === "/ai/risk") return risk(body);
  if (url === "/risk/settings") {
    const state = loadState();
    state.riskSettings = { ...(state.riskSettings || defaultRiskSettings()), ...body };
    saveState(state);
    return respond({ settings: state.riskSettings });
  }

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
    return withQuote({ ...stock, price: newPrice, change });
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
