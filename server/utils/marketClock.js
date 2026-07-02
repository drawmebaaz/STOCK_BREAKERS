const pad = (value) => String(value).padStart(2, "0");

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const config = {
  enabled: toBool(process.env.MARKET_CLOCK_ENABLED, true),
  demoAlwaysOpen: toBool(process.env.MARKET_DEMO_ALWAYS_OPEN, false),
  minutesPerTick: Math.max(1, Number(process.env.SIM_MINUTES_PER_TICK || 5)),
  afterHoursMinutesPerTick: Math.max(1, Number(process.env.AFTER_HOURS_MINUTES_PER_TICK || 30)),
};

const start = new Date("2026-07-01T09:25:00.000Z");

let state = {
  simulatedAt: new Date(start),
  tick: 0,
  lastEvent: null,
};

const minutesOfDay = (date = state.simulatedAt) => date.getUTCHours() * 60 + date.getUTCMinutes();

export const getSessionForMinute = (minute) => {
  if (!config.enabled || config.demoAlwaysOpen) return "OPEN";
  if (minute >= 8 * 60 && minute < 9 * 60 + 30) return "PRE_MARKET";
  if (minute >= 9 * 60 + 30 && minute < 16 * 60) return "OPEN";
  if (minute >= 16 * 60 && minute < 20 * 60) return "AFTER_HOURS";
  return "CLOSED";
};

const eventForTransition = (before, after) => {
  if (before.session !== "OPEN" && after.session === "OPEN") return "MARKET_OPEN";
  if (before.session === "OPEN" && after.session !== "OPEN") return "MARKET_CLOSE";
  if (before.date !== after.date) return "END_OF_DAY";
  return null;
};

const nextEvent = (minute) => {
  if (!config.enabled || config.demoAlwaysOpen) {
    return { name: "MARKET_CLOSE", inMinutes: 390 };
  }
  if (minute < 9 * 60 + 30) return { name: "MARKET_OPEN", inMinutes: 9 * 60 + 30 - minute };
  if (minute < 16 * 60) return { name: "MARKET_CLOSE", inMinutes: 16 * 60 - minute };
  if (minute < 20 * 60) return { name: "AFTER_HOURS_CLOSE", inMinutes: 20 * 60 - minute };
  return { name: "NEXT_MARKET_OPEN", inMinutes: 24 * 60 - minute + 9 * 60 + 30 };
};

export const getMarketClockStatus = () => {
  const minute = minutesOfDay();
  const session = getSessionForMinute(minute);
  const next = nextEvent(minute);
  return {
    session,
    status: session,
    isOpen: session === "OPEN",
    allowsMarketOrders: session === "OPEN" || session === "PRE_MARKET" || session === "AFTER_HOURS",
    simulatedDate: state.simulatedAt.toISOString().slice(0, 10),
    simulatedTime: `${pad(state.simulatedAt.getUTCHours())}:${pad(state.simulatedAt.getUTCMinutes())}`,
    tick: state.tick,
    minutesPerTick: session === "AFTER_HOURS" || session === "CLOSED"
      ? config.afterHoursMinutesPerTick
      : config.minutesPerTick,
    nextEvent: next.name,
    nextEventInSimMinutes: next.inMinutes,
    lastEvent: state.lastEvent,
    label: `${session.replace("_", " ")} simulated session`,
  };
};

export const advanceMarketClock = () => {
  const before = getMarketClockStatus();
  const minutes = before.minutesPerTick;
  state = {
    ...state,
    tick: state.tick + 1,
    simulatedAt: new Date(state.simulatedAt.getTime() + minutes * 60000),
  };
  const after = getMarketClockStatus();
  state.lastEvent = eventForTransition(before, after);
  return { ...after, lastEvent: state.lastEvent };
};

export const resetMarketClock = (date = start) => {
  state = { simulatedAt: new Date(date), tick: 0, lastEvent: null };
  return getMarketClockStatus();
};

