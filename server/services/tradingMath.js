export const roundMoney = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

export const calculateSlippage = ({ quote, side, quantity }) => {
  const price = Number(quote?.mid || quote?.price || 0);
  const liquidityScore = Math.max(0.1, Number(quote?.liquidityScore || 0.75));
  const averageVolume = Math.max(1000, Number(quote?.averageVolume || 500000));
  const volatility = Math.abs(Number(quote?.percentChange || quote?.change || 0)) / 100;
  const quantityImpact = Math.min(0.006, quantity / averageVolume / liquidityScore);
  const volatilityImpact = Math.min(0.004, volatility * 0.18);
  const lowLiquidityImpact = (1 - liquidityScore) * 0.0015;
  const base = 0.00015;
  const deterministicNoise = ((quantity * 9301 + price * 49297) % 233280) / 233280 * 0.00025;
  const slippagePct = Math.min(0.0125, base + quantityImpact + volatilityImpact + lowLiquidityImpact + deterministicNoise);
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
}) => {
  if (totalTrades === 0) return 100;
  const score =
    100 -
    unplannedTrades * 10 -
    tradesWithoutStop * 15 -
    oversizedTrades * 10 -
    poorExitCount * 10 -
    revengeTradeSignals * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
};
