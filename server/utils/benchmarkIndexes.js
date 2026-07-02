const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

let indexHistory = {};
let indexes = [];

const definitionsFor = (profiles) => {
  const sectors = [...new Set(profiles.map((profile) => profile.sector))];
  return [
    { symbol: "SBX_TOTAL", name: "StockBreakers Total Market", members: profiles.map((profile) => profile.ticker) },
    ...sectors.map((sector) => ({
      symbol: `SBX_${sector.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)}`,
      name: `${sector} Benchmark`,
      sector,
      members: profiles.filter((profile) => profile.sector === sector).map((profile) => profile.ticker),
    })),
  ];
};

export const updateBenchmarkIndexes = ({ profiles, quotes, clock }) => {
  const quoteMap = new Map(quotes.map((quote) => [quote.ticker, quote]));
  indexes = definitionsFor(profiles).map((definition) => {
    const memberQuotes = definition.members.map((ticker) => quoteMap.get(ticker)).filter(Boolean);
    const currentValue = memberQuotes.length
      ? memberQuotes.reduce((sum, quote) => sum + Number(quote.price || 0), 0) / memberQuotes.length
      : 0;
    const prior = indexHistory[definition.symbol]?.at(-1);
    const point = {
      symbol: definition.symbol,
      value: round(currentValue),
      simulatedDate: clock.simulatedDate,
      simulatedTime: clock.simulatedTime,
      timestamp: new Date().toISOString(),
    };
    indexHistory[definition.symbol] = [...(indexHistory[definition.symbol] || []), point].slice(-500);
    const sameDayHistory = indexHistory[definition.symbol].filter((item) => item.simulatedDate === clock.simulatedDate);
    const dayOpen = sameDayHistory[0]?.value || currentValue;
    return {
      ...definition,
      currentValue: point.value,
      dayOpen: round(dayOpen),
      dayChange: round(point.value - (prior?.value || point.value)),
      dayChangePercent: dayOpen > 0 ? round(((point.value - dayOpen) / dayOpen) * 100, 2) : 0,
      history: indexHistory[definition.symbol].slice(-120),
    };
  });
  return indexes;
};

export const getBenchmarkIndexes = () => indexes;

export const getBenchmarkIndex = (symbol) =>
  indexes.find((index) => index.symbol === String(symbol || "").toUpperCase()) || null;
