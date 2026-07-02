const HISTORY_LIMIT = 500;
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

let candlesByTicker = {};

export const initializeCandles = (profiles) => {
  candlesByTicker = {};
  for (const profile of profiles) {
    let price = profile.price * 0.96;
    candlesByTicker[profile.ticker] = Array.from({ length: 90 }, (_, index) => {
      const open = price;
      price = Math.max(1, price * (1 + Math.sin(index / 9) * 0.002 + (profile.betaToMarket - 1) * 0.0004));
      const close = index === 89 ? profile.price : price;
      return {
        ticker: profile.ticker,
        timestamp: new Date(Date.now() - (90 - index) * 60000).toISOString(),
        simulatedDate: "2026-07-01",
        simulatedTime: "09:30",
        session: "OPEN",
        open: round(open),
        high: round(Math.max(open, close) * 1.002),
        low: round(Math.min(open, close) * 0.998),
        close: round(close),
        volume: Math.round(profile.averageVolume * 0.25),
        regime: "NORMAL",
      };
    });
  }
  return candlesByTicker;
};

export const updateCandle = ({ ticker, quote, clock, regime }) => {
  const list = candlesByTicker[ticker] || [];
  const previous = list.at(-1);
  const open = previous?.close || quote.price;
  const candle = {
    ticker,
    timestamp: new Date().toISOString(),
    simulatedDate: clock.simulatedDate,
    simulatedTime: clock.simulatedTime,
    session: clock.session,
    open: round(open),
    high: round(Math.max(open, quote.price, quote.ask)),
    low: round(Math.min(open, quote.price, quote.bid)),
    close: round(quote.price),
    volume: Number(quote.volume || 0),
    regime,
  };
  candlesByTicker[ticker] = [...list, candle].slice(-HISTORY_LIMIT);
  return candle;
};

export const getCandlesForTicker = (ticker, limit = 120) => {
  const history = candlesByTicker[ticker];
  if (!history) return null;
  return history.slice(-Math.min(Math.max(Number(limit) || 120, 10), HISTORY_LIMIT));
};

export const getPriceHistoryFromCandles = (ticker, limit = 120) => {
  const candles = getCandlesForTicker(ticker, limit);
  return candles?.map((candle) => candle.close) || null;
};

export const getDayStats = (ticker) => {
  const day = getCandlesForTicker(ticker, 90) || [];
  return {
    dayOpen: day[0]?.open,
    dayHigh: Math.max(...day.map((item) => item.high)),
    dayLow: Math.min(...day.map((item) => item.low)),
    dayVolume: day.reduce((sum, item) => sum + Number(item.volume || 0), 0),
  };
};

export const getCandleCount = () =>
  Object.values(candlesByTicker).reduce((sum, candles) => sum + candles.length, 0);

