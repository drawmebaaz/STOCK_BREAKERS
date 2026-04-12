// In-memory price store — never persisted to DB
export const MOCK_STOCKS = [
  { ticker: "AAPL",  name: "Apple Inc.",          price: 189.50, sector: "Technology",   change: 0 },
  { ticker: "MSFT",  name: "Microsoft Corp.",      price: 415.20, sector: "Technology",   change: 0 },
  { ticker: "GOOGL", name: "Alphabet Inc.",        price: 175.80, sector: "Technology",   change: 0 },
  { ticker: "AMZN",  name: "Amazon.com Inc.",      price: 195.60, sector: "Consumer",     change: 0 },
  { ticker: "TSLA",  name: "Tesla Inc.",           price: 245.10, sector: "Automotive",   change: 0 },
  { ticker: "NVDA",  name: "NVIDIA Corp.",         price: 875.40, sector: "Technology",   change: 0 },
  { ticker: "META",  name: "Meta Platforms",       price: 505.30, sector: "Technology",   change: 0 },
  { ticker: "JPM",   name: "JPMorgan Chase",       price: 198.70, sector: "Finance",      change: 0 },
  { ticker: "JNJ",   name: "Johnson & Johnson",    price: 152.40, sector: "Healthcare",   change: 0 },
  { ticker: "V",     name: "Visa Inc.",            price: 275.90, sector: "Finance",      change: 0 },
  { ticker: "WMT",   name: "Walmart Inc.",         price: 68.50,  sector: "Consumer",     change: 0 },
  { ticker: "DIS",   name: "Walt Disney Co.",      price: 112.30, sector: "Entertainment",change: 0 },
  { ticker: "NFLX",  name: "Netflix Inc.",         price: 635.80, sector: "Entertainment",change: 0 },
  { ticker: "COIN",  name: "Coinbase Global",      price: 225.60, sector: "Finance",      change: 0 },
  { ticker: "PLTR",  name: "Palantir Technologies",price: 24.80,  sector: "Technology",   change: 0 },
];

// Mutable live prices — updated by the price engine
let livePrices = MOCK_STOCKS.map(s => ({ ...s }));

export const getLivePrices = () => livePrices;

export const updatePrices = () => {
  livePrices = livePrices.map(stock => {
    const drift = (Math.random() - 0.48) * 0.018; // slight upward bias
    const newPrice = +(stock.price * (1 + drift)).toFixed(2);
    const change = +((newPrice - stock.price) / stock.price * 100).toFixed(2);
    return { ...stock, price: newPrice, change };
  });
  return livePrices;
};

export const getPriceMap = () => {
  return livePrices.reduce((acc, s) => ({ ...acc, [s.ticker]: s.price }), {});
};
