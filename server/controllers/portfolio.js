import { EquitySnapshot, Holding, TradePlan, TradeReview, Transaction } from "../models/index.js";
import { getLivePrices, getPriceMap, getQuote } from "../utils/priceStore.js";
import { getOrCreateRiskSettings } from "../services/orderEngine.js";

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
        reservedQuantity: Number(h.reservedQuantity || 0),
        availableQuantity: Math.max(0, Number(h.quantity || 0) - Number(h.reservedQuantity || 0)),
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
    const reservedCash = Number(req.user.reservedCash || 0);
    const availableCash = Math.max(0, Number(cash || 0) - reservedCash);

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
      reservedCash: +reservedCash.toFixed(2),
      availableCash: +availableCash.toFixed(2),
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

const maxDrawdownFromSnapshots = (snapshots) => {
  let peak = 0;
  let maxDrawdown = 0;
  snapshots.forEach((snapshot) => {
    const equity = Number(snapshot.totalEquity || 0);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, (equity - peak) / peak);
  });
  return +(maxDrawdown * 100).toFixed(2);
};

const average = (values) => {
  const clean = values.map(Number).filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
};

const rebuildRealizedPnl = (transactions) => {
  const positions = new Map();
  const sells = [];

  [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((txn) => {
    const current = positions.get(txn.ticker) || { quantity: 0, costBasis: 0 };
    const quantity = Number(txn.filledQuantity || txn.quantity || 0);
    const total = Number(txn.total || 0);

    if (txn.type === "buy") {
      positions.set(txn.ticker, {
        quantity: current.quantity + quantity,
        costBasis: current.costBasis + total,
      });
      return;
    }

    const avgCost = current.quantity > 0 ? current.costBasis / current.quantity : Number(txn.avgCostBefore || txn.price || 0);
    const realizedPnl = txn.realizedPnl ?? ((Number(txn.price || 0) - avgCost) * quantity);
    sells.push({
      ticker: txn.ticker,
      realizedPnl: Number(realizedPnl || 0),
      realizedR: txn.realizedR ?? null,
      createdAt: txn.createdAt,
    });
    const matchedQty = Math.min(quantity, current.quantity);
    const nextQty = Math.max(0, current.quantity - matchedQty);
    positions.set(txn.ticker, {
      quantity: nextQty,
      costBasis: nextQty > 0 ? current.costBasis - avgCost * matchedQty : 0,
    });
  });

  return sells;
};

export const getPortfolioAnalytics = async (req, res, next) => {
  try {
    const [holdings, transactions, tradePlans, reviews, snapshots, riskSettings] = await Promise.all([
      Holding.find({ userId: req.user._id }),
      Transaction.find({ userId: req.user._id }).sort({ createdAt: 1 }).limit(1000),
      TradePlan.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500),
      TradeReview.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500),
      EquitySnapshot.find({ userId: req.user._id }).sort({ timestamp: 1 }).limit(1000),
      getOrCreateRiskSettings(req.user._id),
    ]);

    const quotes = getLivePrices();
    const priceMap = getPriceMap();
    const quoteByTicker = new Map(quotes.map((quote) => [quote.ticker, quote]));
    const cash = Number(req.user.cashBalance || 0);
    const realizedTrades = rebuildRealizedPnl(transactions);
    const realizedPnl = realizedTrades.reduce((sum, trade) => sum + trade.realizedPnl, 0);

    const enrichedHoldings = holdings.map((holding) => {
      const quote = quoteByTicker.get(holding.ticker);
      const currentPrice = priceMap[holding.ticker] ?? holding.avgCost;
      const currentValue = currentPrice * holding.quantity;
      const unrealizedPnl = currentValue - holding.totalInvested;
      return {
        ticker: holding.ticker,
        sector: quote?.sector || "Unclassified",
        quantity: holding.quantity,
        avgCost: holding.avgCost,
        currentPrice,
        currentValue,
        totalInvested: holding.totalInvested,
        unrealizedPnl,
        unrealizedPnlPct: holding.totalInvested > 0 ? (unrealizedPnl / holding.totalInvested) * 100 : 0,
      };
    });

    const marketValue = enrichedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
    const unrealizedPnl = enrichedHoldings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);
    const totalEquity = cash + marketValue;
    const totalPnl = realizedPnl + unrealizedPnl;
    const wins = realizedTrades.filter((trade) => trade.realizedPnl > 0);
    const losses = realizedTrades.filter((trade) => trade.realizedPnl < 0);
    const grossWins = wins.reduce((sum, trade) => sum + trade.realizedPnl, 0);
    const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.realizedPnl, 0));
    const rMultiples = realizedTrades.map((trade) => trade.realizedR).filter((value) => value !== null && value !== undefined);

    const sectorExposure = Object.values(enrichedHoldings.reduce((acc, holding) => {
      const sector = holding.sector;
      acc[sector] = acc[sector] || { sector, value: 0, weight: 0 };
      acc[sector].value += holding.currentValue;
      return acc;
    }, {})).map((item) => ({
      ...item,
      value: +item.value.toFixed(2),
      weight: totalEquity > 0 ? +((item.value / totalEquity) * 100).toFixed(2) : 0,
      warning: totalEquity > 0 ? (item.value / totalEquity) * 100 > riskSettings.maxSectorExposurePercent : false,
    })).sort((a, b) => b.value - a.value);

    const tickerConcentration = enrichedHoldings
      .map((holding) => ({
        ticker: holding.ticker,
        value: +holding.currentValue.toFixed(2),
        weight: totalEquity > 0 ? +((holding.currentValue / totalEquity) * 100).toFixed(2) : 0,
        warning: totalEquity > 0 ? (holding.currentValue / totalEquity) * 100 > riskSettings.maxTickerExposurePercent : false,
      }))
      .sort((a, b) => b.weight - a.weight);

    const latestPlanByTicker = new Map();
    tradePlans
      .filter((plan) => plan.status === "OPEN" && Number(plan.stopLoss || 0) > 0)
      .forEach((plan) => {
        if (!latestPlanByTicker.has(plan.ticker)) latestPlanByTicker.set(plan.ticker, plan);
      });

    const openRiskAmount = enrichedHoldings.reduce((sum, holding) => {
      const plan = latestPlanByTicker.get(holding.ticker);
      if (!plan) return sum;
      const quote = getQuote(holding.ticker);
      const price = quote?.bid || holding.currentPrice;
      const riskPerShare = Math.max(0, price - Number(plan.stopLoss || 0));
      return sum + riskPerShare * holding.quantity;
    }, 0);

    const setupStats = Object.values(tradePlans.reduce((acc, plan) => {
      const key = plan.setupType || "PRACTICE";
      acc[key] = acc[key] || { setupType: key, trades: 0, averageRewardRisk: 0, rewardRiskSum: 0 };
      acc[key].trades += 1;
      acc[key].rewardRiskSum += Number(plan.rewardRiskRatio || 0);
      acc[key].averageRewardRisk = +(acc[key].rewardRiskSum / acc[key].trades).toFixed(2);
      return acc;
    }, {})).map(({ rewardRiskSum, ...item }) => item);

    const bestTicker = [...enrichedHoldings].sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)[0] || null;
    const worstTicker = [...enrichedHoldings].sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)[0] || null;

    res.json({
      totalEquity: +totalEquity.toFixed(2),
      cash: +cash.toFixed(2),
      marketValue: +marketValue.toFixed(2),
      realizedPnl: +realizedPnl.toFixed(2),
      unrealizedPnl: +unrealizedPnl.toFixed(2),
      totalPnl: +totalPnl.toFixed(2),
      winRate: realizedTrades.length ? +((wins.length / realizedTrades.length) * 100).toFixed(2) : 0,
      lossRate: realizedTrades.length ? +((losses.length / realizedTrades.length) * 100).toFixed(2) : 0,
      averageWin: +average(wins.map((trade) => trade.realizedPnl)).toFixed(2),
      averageLoss: +average(losses.map((trade) => trade.realizedPnl)).toFixed(2),
      biggestWin: wins.length ? +Math.max(...wins.map((trade) => trade.realizedPnl)).toFixed(2) : 0,
      biggestLoss: losses.length ? +Math.min(...losses.map((trade) => trade.realizedPnl)).toFixed(2) : 0,
      profitFactor: grossLosses > 0 ? +(grossWins / grossLosses).toFixed(2) : grossWins > 0 ? null : 0,
      expectancy: realizedTrades.length ? +(realizedPnl / realizedTrades.length).toFixed(2) : 0,
      maxDrawdown: maxDrawdownFromSnapshots(snapshots),
      averageHoldingPeriod: null,
      openRiskAmount: +openRiskAmount.toFixed(2),
      openRiskPercent: totalEquity > 0 ? +((openRiskAmount / totalEquity) * 100).toFixed(2) : 0,
      tickerConcentration,
      sectorExposure,
      bestTicker,
      worstTicker,
      totalTrades: transactions.length,
      realizedTradeCount: realizedTrades.length,
      plannedTradesCount: tradePlans.length,
      followedPlanRate: reviews.length ? +((reviews.filter((review) => review.followedPlan).length / reviews.length) * 100).toFixed(2) : 0,
      rMultipleCount: rMultiples.length,
      averageRMultiple: +average(rMultiples).toFixed(2),
      bestR: rMultiples.length ? +Math.max(...rMultiples).toFixed(2) : null,
      worstR: rMultiples.length ? +Math.min(...rMultiples).toFixed(2) : null,
      setupStats,
      riskWarnings: [
        ...tickerConcentration.filter((item) => item.warning).map((item) => `${item.ticker} is above your single-stock limit.`),
        ...sectorExposure.filter((item) => item.warning).map((item) => `${item.sector} exposure is above your sector limit.`),
        openRiskAmount > 0 && totalEquity > 0 && (openRiskAmount / totalEquity) * 100 > riskSettings.maxPortfolioRiskPercent
          ? "Open planned risk is above your portfolio risk limit."
          : null,
      ].filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
};
