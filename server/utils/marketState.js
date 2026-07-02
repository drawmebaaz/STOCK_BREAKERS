const sectors = ["Technology", "Consumer", "Automotive", "Financials", "Healthcare", "Entertainment"];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

let marketState = {
  marketTrend: 4,
  marketSentiment: 6,
  volatilityRegime: "NORMAL",
  sectorSentiments: Object.fromEntries(sectors.map((sector) => [sector, 0])),
  activeEventCount: 0,
  currentDayReturn: 0,
  currentMonthReturn: 0,
  currentYearReturn: 0,
};

const regimeFor = (tick) => {
  if (tick % 193 === 0) return "NEWS_SHOCK";
  if (tick % 149 === 0) return "HIGH_VOLATILITY";
  if (tick % 521 === 0) return "CRASH";
  if (tick % 337 === 0) return "RECOVERY";
  if (tick % 89 === 0) return "LOW_VOLATILITY";
  return marketState.volatilityRegime === "CRASH" ? "RECOVERY" : "NORMAL";
};

export const updateMarketState = ({ clock, activeEvents = [] }) => {
  const eventBias = activeEvents.reduce((sum, event) => sum + Number(event.currentImpact?.sentiment || 0), 0);
  const regime = regimeFor(clock.tick);
  const trendDrift = Math.sin(clock.tick / 38) * 0.6 + eventBias * 0.015;

  marketState.marketTrend = clamp(marketState.marketTrend * 0.985 + trendDrift, -50, 50);
  marketState.marketSentiment = clamp(marketState.marketSentiment * 0.98 + eventBias * 0.03, -50, 50);
  marketState.volatilityRegime = regime;
  marketState.activeEventCount = activeEvents.length;
  marketState.currentDayReturn = clamp(marketState.currentDayReturn + marketState.marketTrend * 0.0003, -12, 12);
  marketState.currentMonthReturn = clamp(marketState.currentMonthReturn + marketState.marketTrend * 0.00008, -35, 35);
  marketState.currentYearReturn = clamp(marketState.currentYearReturn + marketState.marketTrend * 0.00002, -60, 80);
  marketState.sectorSentiments = Object.fromEntries(
    Object.entries(marketState.sectorSentiments).map(([sector, value], index) => [
      sector,
      clamp(value * 0.985 + Math.sin(clock.tick / (29 + index * 3)) * 0.2, -50, 50),
    ])
  );

  for (const event of activeEvents) {
    if (event.scope === "SECTOR" && event.sector) {
      marketState.sectorSentiments[event.sector] = clamp(
        (marketState.sectorSentiments[event.sector] || 0) + Number(event.currentImpact?.sentiment || 0) * 0.05,
        -50,
        50
      );
    }
  }

  return getMarketState();
};

export const getMarketState = () => ({ ...marketState, sectorSentiments: { ...marketState.sectorSentiments } });

export const resetMarketState = () => {
  marketState = {
    marketTrend: 4,
    marketSentiment: 6,
    volatilityRegime: "NORMAL",
    sectorSentiments: Object.fromEntries(sectors.map((sector) => [sector, 0])),
    activeEventCount: 0,
    currentDayReturn: 0,
    currentMonthReturn: 0,
    currentYearReturn: 0,
  };
  return getMarketState();
};

