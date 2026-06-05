export const MOCK_STOCKS = [
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

let livePrices = MOCK_STOCKS.map((stock) => ({ ...stock }));
const HISTORY_LIMIT = 240;

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

const generateInitialHistory = (stock, points = 90) => {
  const rng = seededRandom(hashTicker(stock.ticker));
  const sectorBias = stock.sector === "Technology" ? 0.0008 : stock.sector === "Finance" ? 0.00035 : 0.00015;
  const volatility = stock.price > 500 ? 0.018 : stock.price < 50 ? 0.024 : 0.014;
  let price = stock.price * (0.92 + rng() * 0.16);
  const prices = [];

  for (let index = 0; index < points; index += 1) {
    const cycle = Math.sin(index / 8 + rng() * 0.2) * 0.003;
    const shock = (rng() - 0.5) * volatility;
    price = Math.max(1, price * (1 + sectorBias + cycle + shock));
    prices.push(+price.toFixed(2));
  }

  const scale = stock.price / prices.at(-1);
  return prices.map((value, index) => (index === prices.length - 1 ? stock.price : +(value * scale).toFixed(2)));
};

let priceHistory = MOCK_STOCKS.reduce((history, stock) => {
  history[stock.ticker] = generateInitialHistory(stock);
  return history;
}, {});

export const getLivePrices = () => livePrices;

export const updatePrices = () => {
  livePrices = livePrices.map((stock) => {
    const drift = (Math.random() - 0.48) * 0.018;
    const newPrice = +(stock.price * (1 + drift)).toFixed(2);
    const change = +(((newPrice - stock.price) / stock.price) * 100).toFixed(2);
    const history = priceHistory[stock.ticker] || [stock.price];
    priceHistory[stock.ticker] = [...history, newPrice].slice(-HISTORY_LIMIT);
    return { ...stock, price: newPrice, change };
  });
  return livePrices;
};

export const getPriceHistory = (ticker, limit = 120) => {
  const history = priceHistory[ticker];
  if (!history) return null;
  return history.slice(-Math.min(Math.max(limit, 10), HISTORY_LIMIT));
};

export const getPriceMap = () =>
  livePrices.reduce((acc, stock) => {
    acc[stock.ticker] = stock.price;
    return acc;
  }, {});
