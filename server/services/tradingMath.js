export const roundMoney = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

export const calculateSlippage = ({ quote, side, quantity }) => {
  const price = Number(quote?.mid || quote?.price || 0);
  const liquidityScore = Math.max(0.1, Number(quote?.liquidityScore || 0.75));
  const visibleVolume = Math.max(1000, Number(quote?.volume || quote?.averageVolume || 500000));
  const spreadPct = price > 0 ? Math.max(0, Number(quote?.spread || 0) / price) : 0;
  const participation = Math.min(1, Number(quantity || 0) / Math.max(1, visibleVolume * liquidityScore));
  const regime = String(quote?.volatilityRegime || quote?.regime || "NORMAL").toUpperCase();
  const regimeImpact = {
    LOW: 0.00005,
    NORMAL: 0.00015,
    HIGH: 0.0007,
    NEWS: 0.001,
    CRASH: 0.0015,
    RECOVERY: 0.0005,
  }[regime] ?? 0.0002;
  const base = 0.0001;
  const spreadImpact = Math.min(0.003, spreadPct * 0.25);
  const participationImpact = Math.min(0.0075, participation * 0.015);
  const lowLiquidityImpact = (1 - liquidityScore) * 0.002;
  const eventImpact = Math.min(0.0015, Number(quote?.activeEventCount || 0) * 0.00035);
  const deterministicNoise = ((quantity * 9301 + price * 49297) % 233280) / 233280 * 0.00025;
  const slippagePct = Math.min(
    0.015,
    base + spreadImpact + participationImpact + lowLiquidityImpact + regimeImpact + eventImpact + deterministicNoise
  );
  const slippage = price * slippagePct;
  return side === "BUY" ? roundMoney(slippage, 4) : -roundMoney(slippage, 4);
};

export const estimateFillQuantity = ({ quote, quantity, orderType }) => {
  if (orderType === "LIMIT") {
    const maxByVolume = Math.max(1, Math.floor(Number(quote?.volume || 1000) * Number(quote?.liquidityScore || 0.75) * 0.004));
    return Math.min(quantity, maxByVolume);
  }
  const maxByVolume = Math.max(1, Math.floor(Number(quote?.volume || 1000) * Number(quote?.liquidityScore || 0.75) * 0.008));
  return Math.min(quantity, maxByVolume);
};

export const calculateRiskPlan = ({
  side = "BUY",
  entryPrice,
  stopLoss,
  targetPrice,
  quantity,
  totalEquity,
  maxRiskPerTradePercent = 2,
}) => {
  const entry = Number(entryPrice || 0);
  const stop = Number(stopLoss || 0);
  const target = Number(targetPrice || 0);
  const qty = Number(quantity || 0);
  const equity = Number(totalEquity || 0);
  const riskPerShare = side === "BUY" ? entry - stop : stop - entry;
  const rewardPerShare = side === "BUY" ? target - entry : entry - target;
  const plannedRiskAmount = riskPerShare > 0 ? riskPerShare * qty : 0;
  const plannedRewardAmount = rewardPerShare > 0 ? rewardPerShare * qty : 0;
  const allowedRiskAmount = equity * (Number(maxRiskPerTradePercent || 2) / 100);
  const maxQuantityByRisk = riskPerShare > 0 ? Math.floor(allowedRiskAmount / riskPerShare) : 0;

  return {
    riskPerShare: roundMoney(riskPerShare, 4),
    rewardPerShare: roundMoney(rewardPerShare, 4),
    plannedRiskAmount: roundMoney(plannedRiskAmount),
    plannedRewardAmount: roundMoney(plannedRewardAmount),
    plannedRiskPercent: equity > 0 ? roundMoney((plannedRiskAmount / equity) * 100, 2) : 0,
    rewardRiskRatio: plannedRiskAmount > 0 ? roundMoney(plannedRewardAmount / plannedRiskAmount, 2) : 0,
    maxQuantityByRisk: Math.max(0, maxQuantityByRisk),
    positionSizeWarning: plannedRiskAmount > allowedRiskAmount && allowedRiskAmount > 0,
    validStop: side === "BUY" ? stop > 0 && stop < entry : stop > entry,
    validTarget: side === "BUY" ? target > entry : target > 0 && target < entry,
  };
};

export const calculateDisciplineScore = ({
  totalTrades = 0,
  unplannedTrades = 0,
  tradesWithoutStop = 0,
  oversizedTrades = 0,
  poorExitCount = 0,
  revengeTradeSignals = 0,
  reviewedTrades = 0,
}) => {
  const trades = Math.max(0, Number(totalTrades || 0));
  if (trades === 0) {
    return {
      score: null,
      label: "Not enough data",
      confidence: "LOW",
      components: {
        planning: 0,
        risk: 0,
        sizing: 0,
        review: 0,
        behavior: 0,
      },
      componentWeights: {
        planning: 0.3,
        risk: 0.3,
        sizing: 0.15,
        review: 0.15,
        behavior: 0.1,
      },
    };
  }

  const ratio = (badCount) => Math.min(1, Math.max(0, Number(badCount || 0) / trades));
  const positiveRatio = (goodCount) => Math.min(1, Math.max(0, Number(goodCount || 0) / trades));
  const components = {
    planning: 1 - ratio(unplannedTrades),
    risk: 1 - ratio(tradesWithoutStop),
    sizing: 1 - ratio(oversizedTrades),
    review: positiveRatio(reviewedTrades),
    behavior: 1 - ratio(poorExitCount + revengeTradeSignals),
  };
  const componentWeights = {
    planning: 0.3,
    risk: 0.3,
    sizing: 0.15,
    review: 0.15,
    behavior: 0.1,
  };
  const weighted =
    components.planning * componentWeights.planning +
    components.risk * componentWeights.risk +
    components.sizing * componentWeights.sizing +
    components.review * componentWeights.review +
    components.behavior * componentWeights.behavior;
  const score = Math.round(Math.max(0, Math.min(1, weighted)) * 100);
  const label = score >= 80 ? "Strong routine" : score >= 60 ? "Mostly controlled" : score >= 40 ? "Needs structure" : "High-risk habits";
  const confidence = trades >= 20 ? "HIGH" : trades >= 8 ? "MEDIUM" : "LOW";

  return { score, label, confidence, components, componentWeights };
};
