import { Router } from "express";
import { Order, TradePlan, TradeReview, Transaction } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { calculateDisciplineScore } from "../services/tradingMath.js";
import { getOrCreateRiskSettings } from "../services/orderEngine.js";

const router = Router();

const average = (values) => {
  const clean = values.map(Number).filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
};

const biggestLeak = ({ unplannedTrades, tradesWithoutStop, oversizedTrades, poorExitCount, revengeTradeSignals }) => {
  const items = [
    { key: "Planning gap", count: unplannedTrades },
    { key: "Missing stop-loss", count: tradesWithoutStop },
    { key: "Oversized trades", count: oversizedTrades },
    { key: "Exit discipline", count: poorExitCount },
    { key: "Fast re-entry after losses", count: revengeTradeSignals },
  ];
  return items.sort((a, b) => b.count - a.count)[0]?.count > 0 ? items[0].key : "No clear leak yet";
};

const pct = (value) => +((Number(value || 0)) * 100).toFixed(1);

const scoreExplanation = ({ score, totalTrades }) => {
  if (score === null || totalTrades === 0) {
    return "Place a few practice orders with a written plan before judging discipline. Right now there is not enough behavior data.";
  }
  if (score >= 80) return "Your process is mostly healthy. Keep planning trades and reviewing exits so the pattern stays visible.";
  if (score >= 60) return "Your routine is usable, but one or two habits are weakening the process. Fix the lowest component first.";
  if (score >= 40) return "The app is seeing repeated process gaps. Before chasing results, make each trade easier to explain and review.";
  return "This account is currently practicing with high-risk habits. Slow down, add stop-losses, and reduce trade size until the routine improves.";
};

const buildNextTradeChecklist = ({ leak, riskSettings }) => {
  const base = [
    "Write the entry reason in one plain sentence.",
    "Set the price that would prove the trade wrong.",
    `Keep planned loss within ${riskSettings.maxRiskPerTradePercent}% of account equity.`,
  ];
  const extra = {
    "Planning gap": "Do not place the order until the trade plan box has a reason.",
    "Missing stop-loss": "Add a stop-loss before submitting a buy order.",
    "Oversized trades": "Use the max-size-by-risk number instead of a round quantity.",
    "Exit discipline": "After selling, review whether the exit matched the original plan.",
    "Fast re-entry after losses": "Wait at least one full price update before re-entering the same stock after a loss.",
    "No clear leak yet": "Review the next closed trade so the app can keep the feedback useful.",
  }[leak];
  return [...base, extra].filter(Boolean);
};

const recommendationCards = (leak, riskSettings) => {
  const cards = {
    "Planning gap": [
      "For the next 5 orders, write one plain reason for entry before placing the order.",
      "Use the trade plan section even for small practice trades so your history is useful later.",
    ],
    "Missing stop-loss": [
      `Add a stop-loss to each buy order. Your default risk setting is ${riskSettings.defaultStopLossPercent}%.`,
      "Skip trades where you cannot name the price that would prove the idea wrong.",
    ],
    "Oversized trades": [
      `Keep planned risk under ${riskSettings.maxRiskPerTradePercent}% of your account for the next 5 orders.`,
      "Use the calculated max quantity instead of choosing round numbers by habit.",
    ],
    "Exit discipline": [
      "Before closing a trade, compare the exit to the reason you entered.",
      "Review at least one closed trade and mark whether you followed the plan.",
    ],
    "Fast re-entry after losses": [
      "After a losing sell, wait one full price tick before opening another trade in the same stock.",
      "Write what changed in the setup before re-entering after a loss.",
    ],
  };
  return (cards[leak] || [
    "Keep using planned trades so the app can give better feedback.",
    "Review closed trades once a week and mark the main mistake honestly.",
  ]).map((text, index) => ({ id: `${leak}-${index}`, text }));
};

const detectRevengeSignals = (transactions) => {
  const chronological = [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let count = 0;
  for (let i = 1; i < chronological.length; i += 1) {
    const previous = chronological[i - 1];
    const current = chronological[i];
    const minutes = (new Date(current.createdAt) - new Date(previous.createdAt)) / 60000;
    if (
      previous.type === "sell" &&
      Number(previous.realizedPnl || 0) < 0 &&
      current.type === "buy" &&
      current.ticker === previous.ticker &&
      minutes >= 0 &&
      minutes <= 30
    ) {
      count += 1;
    }
  }
  return count;
};

router.get("/summary", protect, async (req, res, next) => {
  try {
    const [orders, plans, reviews, transactions, riskSettings] = await Promise.all([
      Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500),
      TradePlan.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500),
      TradeReview.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500),
      Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500),
      getOrCreateRiskSettings(req.user._id),
    ]);

    const filledOrders = orders.filter((order) => ["FILLED", "PARTIALLY_FILLED"].includes(order.status));
    const planByOrder = new Set(plans.map((plan) => String(plan.orderId || "")));
    const plannedTrades = filledOrders.filter((order) => planByOrder.has(String(order._id))).length;
    const unplannedTrades = Math.max(0, filledOrders.length - plannedTrades);
    const tradesWithoutStop = plans.filter((plan) => !Number(plan.stopLoss || 0)).length + unplannedTrades;
    const tradesWithTarget = plans.filter((plan) => Number(plan.targetPrice || 0) > 0).length;
    const oversizedTrades = plans.filter((plan) => plan.positionSizeWarning).length;
    const poorExitCount = reviews.filter((review) =>
      (review.mistakeTags || []).some((tag) => ["EXITED_EARLY", "HELD_TOO_LONG", "MOVED_STOP"].includes(tag))
    ).length;
    const revengeTradeSignals = detectRevengeSignals(transactions);
    const noThesisTrades = plans.filter((plan) => !String(plan.thesis || "").trim()).length + unplannedTrades;
    const averageRewardRisk = average(plans.map((plan) => plan.rewardRiskRatio));
    const rValues = transactions.map((txn) => txn.realizedR).filter((value) => value !== null && value !== undefined);
    const averageRMultiple = average(rValues);
    const followedPlanRate = reviews.length
      ? (reviews.filter((review) => review.followedPlan).length / reviews.length) * 100
      : 0;
    const reviewedTrades = reviews.length;

    const scoreBreakdown = calculateDisciplineScore({
      totalTrades: filledOrders.length,
      unplannedTrades,
      tradesWithoutStop,
      oversizedTrades,
      poorExitCount,
      revengeTradeSignals,
      reviewedTrades,
    });
    const leak = biggestLeak({ unplannedTrades, tradesWithoutStop, oversizedTrades, poorExitCount, revengeTradeSignals });

    const setupPerformance = Object.values(plans.reduce((acc, plan) => {
      const setup = plan.setupType || "PRACTICE";
      acc[setup] = acc[setup] || { setupType: setup, trades: 0, averageRewardRisk: 0, oversized: 0, rewardRiskSum: 0 };
      acc[setup].trades += 1;
      acc[setup].rewardRiskSum += Number(plan.rewardRiskRatio || 0);
      acc[setup].averageRewardRisk = +(acc[setup].rewardRiskSum / acc[setup].trades).toFixed(2);
      if (plan.positionSizeWarning) acc[setup].oversized += 1;
      return acc;
    }, {})).map(({ rewardRiskSum, ...item }) => item);

    res.json({
      totalTrades: filledOrders.length,
      plannedTrades,
      unplannedTrades,
      planAdherenceRate: filledOrders.length ? +((plannedTrades / filledOrders.length) * 100).toFixed(2) : 0,
      tradesWithStopLoss: plans.filter((plan) => Number(plan.stopLoss || 0) > 0).length,
      tradesWithTarget,
      averageRewardRisk: +averageRewardRisk.toFixed(2),
      averageRMultiple: +averageRMultiple.toFixed(2),
      followedPlanRate: +followedPlanRate.toFixed(2),
      reviewedTrades,
      overSizedTrades: oversizedTrades,
      oversizedTrades,
      revengeTradeSignals,
      earlyExitCount: reviews.filter((review) => (review.mistakeTags || []).includes("EXITED_EARLY")).length,
      lateExitCount: reviews.filter((review) => (review.mistakeTags || []).includes("HELD_TOO_LONG")).length,
      noThesisTrades,
      biggestBehaviorLeak: leak,
      weeklyDisciplineScore: scoreBreakdown.score,
      scoreLabel: scoreBreakdown.label,
      scoreConfidence: scoreBreakdown.confidence,
      scoreExplanation: scoreExplanation({ score: scoreBreakdown.score, totalTrades: filledOrders.length }),
      scoreBreakdown: {
        planning: pct(scoreBreakdown.components.planning),
        risk: pct(scoreBreakdown.components.risk),
        sizing: pct(scoreBreakdown.components.sizing),
        review: pct(scoreBreakdown.components.review),
        behavior: pct(scoreBreakdown.components.behavior),
        weights: scoreBreakdown.componentWeights,
      },
      improvementTrend: reviews.length >= 3 ? "Enough reviews to start spotting patterns" : "Add more trade reviews to see a trend",
      recommendationCards: recommendationCards(leak, riskSettings),
      nextTradeChecklist: buildNextTradeChecklist({ leak, riskSettings }),
      recentReviews: reviews.slice(0, 8),
      setupPerformance,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
