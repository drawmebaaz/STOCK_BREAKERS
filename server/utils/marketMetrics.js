const values = [];

export const marketMetrics = {
  ticksProcessed: 0,
  lastTickDurationMs: 0,
  averageTickDurationMs: 0,
  maxTickDurationMs: 0,
  activeEvents: 0,
  pendingOrders: 0,
  ordersProcessedLastTick: 0,
  candlesUpdatedLastTick: 0,
  socketClients: 0,
  marketSession: "OPEN",
  fallbackMode: false,
  lastError: null,
  lastSuccessfulTickAt: null,
};

export const recordTickMetrics = ({
  durationMs = 0,
  activeEvents = 0,
  ordersProcessed = 0,
  candlesUpdated = 0,
  session = "OPEN",
  error = null,
} = {}) => {
  marketMetrics.ticksProcessed += 1;
  marketMetrics.lastTickDurationMs = Math.round(durationMs);
  marketMetrics.maxTickDurationMs = Math.max(marketMetrics.maxTickDurationMs, Math.round(durationMs));
  values.push(durationMs);
  if (values.length > 120) values.shift();
  marketMetrics.averageTickDurationMs = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  marketMetrics.activeEvents = activeEvents;
  marketMetrics.ordersProcessedLastTick = ordersProcessed;
  marketMetrics.candlesUpdatedLastTick = candlesUpdated;
  marketMetrics.marketSession = session;
  marketMetrics.lastError = error;
  marketMetrics.fallbackMode = Boolean(error);
  if (!error) marketMetrics.lastSuccessfulTickAt = new Date().toISOString();
};

export const setSocketClientCount = (count) => {
  marketMetrics.socketClients = count;
};

export const setPendingOrdersCount = (count) => {
  marketMetrics.pendingOrders = count;
};

export const getMarketHealth = () => ({ ...marketMetrics });

