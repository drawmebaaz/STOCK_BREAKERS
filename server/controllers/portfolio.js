import { Holding } from "../models/index.js";
import { getPriceMap } from "../utils/priceStore.js";

export const getPortfolio = async (req, res, next) => {
  try {
    const holdings = await Holding.find({ userId: req.user._id });
    const prices = getPriceMap();

    const enriched = holdings.map((h) => {
      const currentPrice = prices[h.ticker] ?? h.avgCost;
      const currentValue = +(currentPrice * h.quantity).toFixed(2);
      const pnl = +(currentValue - h.totalInvested).toFixed(2);
      const pnlPct = h.totalInvested > 0 ? +((pnl / h.totalInvested) * 100).toFixed(2) : 0;
      return {
        ticker: h.ticker,
        quantity: h.quantity,
        avgCost: h.avgCost,
        totalInvested: h.totalInvested,
        currentPrice,
        currentValue,
        pnl,
        pnlPct,
      };
    });

    res.json({ holdings: enriched });
  } catch (err) {
    next(err);
  }
};

export const getPortfolioSummary = async (req, res, next) => {
  try {
    const holdings = await Holding.find({ userId: req.user._id });
    const prices = getPriceMap();
    const cash = req.user.cashBalance;

    let stockValue = 0;
    let totalInvested = 0;

    holdings.forEach((h) => {
      const price = prices[h.ticker] ?? h.avgCost;
      stockValue += price * h.quantity;
      totalInvested += h.totalInvested;
    });

    const totalValue = +(cash + stockValue).toFixed(2);
    const pnl = +(stockValue - totalInvested).toFixed(2);
    const pnlPct = totalInvested > 0 ? +((pnl / totalInvested) * 100).toFixed(2) : 0;

    res.json({
      cash: +cash.toFixed(2),
      stockValue: +stockValue.toFixed(2),
      totalValue,
      totalInvested: +totalInvested.toFixed(2),
      pnl,
      pnlPct,
    });
  } catch (err) {
    next(err);
  }
};
