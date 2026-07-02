import assert from "node:assert/strict";
import test from "node:test";
import { updateBenchmarkIndexes } from "../utils/benchmarkIndexes.js";
import { getCandlesForTicker, initializeCandles, updateCandle } from "../utils/candleStore.js";
import { addMarketEvent, getActiveEvents, resetEvents } from "../utils/eventEngine.js";
import { calculateNextQuote } from "../utils/factorPricingEngine.js";
import { instrumentProfiles } from "../utils/instrumentProfiles.js";
import { advanceMarketClock, getMarketClockStatus, resetMarketClock } from "../utils/marketClock.js";
import { resetMarketState, updateMarketState } from "../utils/marketState.js";

test("market clock advances simulated time and exposes session shape", () => {
  resetMarketClock("2026-07-01T09:25:00.000Z");
  const before = getMarketClockStatus();
  const after = advanceMarketClock();

  assert.equal(before.tick, 0);
  assert.equal(after.tick, 1);
  assert.ok(after.simulatedTime);
  assert.ok(["PRE_MARKET", "OPEN", "AFTER_HOURS", "CLOSED"].includes(after.session));
});

test("factor pricing returns bounded quote fields", () => {
  const profile = instrumentProfiles[0];
  const clock = { session: "OPEN", tick: 10 };
  const marketState = {
    marketSentiment: 8,
    volatilityRegime: "NORMAL",
    sectorSentiments: { [profile.sector]: 5 },
  };
  const quote = calculateNextQuote({
    profile,
    previousQuote: { price: profile.price },
    marketState,
    clock,
    eventImpact: { sentiment: 0, demand: 0, liquidity: 0, volatility: 0, count: 0 },
  });

  assert.ok(quote.price > 0);
  assert.ok(quote.bid < quote.ask);
  assert.ok(Math.abs(quote.rawReturn) <= 0.04);
});

test("event engine stores visible simulated events", () => {
  resetEvents();
  const event = addMarketEvent({
    scope: "TICKER",
    ticker: "AAPL",
    headline: "Simulated Event: test event",
    sentimentImpact: 10,
    createdTick: 1,
  });

  assert.equal(getActiveEvents({ ticker: "AAPL" })[0].id, event.id);
});

test("candle store creates OHLCV candle records", () => {
  initializeCandles(instrumentProfiles.slice(0, 1));
  updateCandle({
    ticker: "AAPL",
    quote: { price: 190, bid: 189.95, ask: 190.05, volume: 1000 },
    clock: { simulatedDate: "2026-07-01", simulatedTime: "10:00", session: "OPEN" },
    regime: "NORMAL",
  });
  const candles = getCandlesForTicker("AAPL", 1);
  const latest = candles.at(-1);

  assert.ok(candles.length >= 1);
  assert.equal(latest.close, 190);
  assert.ok(latest.high >= latest.low);
});

test("benchmark indexes include total market", () => {
  const profiles = instrumentProfiles.slice(0, 3);
  const quotes = profiles.map((profile) => ({ ticker: profile.ticker, price: profile.price }));
  const indexes = updateBenchmarkIndexes({
    profiles,
    quotes,
    clock: { simulatedDate: "2026-07-01", simulatedTime: "10:00" },
  });

  assert.ok(indexes.some((index) => index.symbol === "SBX_TOTAL"));
});

test("benchmark daily return resets by simulated date", () => {
  const profiles = instrumentProfiles.slice(0, 2);
  updateBenchmarkIndexes({
    profiles,
    quotes: profiles.map((profile) => ({ ticker: profile.ticker, price: 100 })),
    clock: { simulatedDate: "2026-07-10", simulatedTime: "10:00" },
  });
  updateBenchmarkIndexes({
    profiles,
    quotes: profiles.map((profile) => ({ ticker: profile.ticker, price: 110 })),
    clock: { simulatedDate: "2026-07-10", simulatedTime: "10:10" },
  });
  const nextDay = updateBenchmarkIndexes({
    profiles,
    quotes: profiles.map((profile) => ({ ticker: profile.ticker, price: 120 })),
    clock: { simulatedDate: "2026-07-11", simulatedTime: "10:00" },
  });
  const total = nextDay.find((index) => index.symbol === "SBX_TOTAL");

  assert.equal(total.dayChangePercent, 0);
});

test("market state reacts to active event context", () => {
  resetMarketState();
  const state = updateMarketState({
    clock: { tick: 10 },
    activeEvents: [{ currentImpact: { sentiment: 20 }, scope: "MARKET" }],
  });

  assert.ok(state.activeEventCount >= 1);
  assert.ok(Number.isFinite(state.marketSentiment));
});
