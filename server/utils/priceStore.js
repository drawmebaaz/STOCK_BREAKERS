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

export const getLivePrices = () => livePrices;

export const updatePrices = () => {
  livePrices = livePrices.map((stock) => {
    const drift = (Math.random() - 0.48) * 0.018;
    const newPrice = +(stock.price * (1 + drift)).toFixed(2);
    const change = +(((newPrice - stock.price) / stock.price) * 100).toFixed(2);
    return { ...stock, price: newPrice, change };
  });
  return livePrices;
};

export const getPriceMap = () =>
  livePrices.reduce((acc, stock) => {
    acc[stock.ticker] = stock.price;
    return acc;
  }, {});
