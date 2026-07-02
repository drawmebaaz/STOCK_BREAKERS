# StockBreakers Interview Notes

## One-Line Pitch

StockBreakers is an educational paper-trading simulator where a user practices buying and selling stocks with virtual money inside a generated market, then reviews portfolio risk, order behavior, scenario ranges, and trading discipline.

## Resume Bullet

- Extended a full-stack paper-trading simulator with a simulated MarketClock, session-aware order handling, OHLCV candles, event-driven factor pricing, generated earnings/news shocks, benchmark indexes, and market-health metrics powering realistic virtual fills, portfolio comparison, scenario analysis, and risk-first trade review.

## Market Engine Flow

```text
MarketClock
  -> EventEngine
  -> MarketState
  -> FactorPricingEngine
  -> CandleStore
  -> BenchmarkIndex engine
  -> Socket.IO broadcast
  -> OrderEngine pending-order checks
  -> Portfolio, Orders, Scenario, Discipline screens
```

## Why MarketClock Exists

Earlier, prices moved continuously without much context. A real trading workflow has sessions, so StockBreakers now separates server time from simulated market time.

MarketClock tracks simulated date, simulated time, tick number, current session, next event, and minutes advanced per tick.

Interview explanation:

> I separated real server time from simulated market time. Prices, pending orders, event decay, candles, and session warnings are driven by MarketClock, not wall-clock assumptions.

## Why Factor Pricing Exists

Pure random movement is hard to defend. The new factor model combines broad market sentiment, sector sentiment, ticker profile, investor confidence, trading demand, innovation potential, liquidity, volatility regime, active events, and bounded noise.

The goal is not real prediction. The goal is a stable, explainable practice market.

## Instrument Profiles

Each ticker has a profile: sector, industry, market-cap bucket, style, base volatility, liquidity score, beta, innovation potential, investor confidence, trading demand, base spread, average volume, and benchmark weight.

These values affect spread, slippage, price movement, volume, and event sensitivity.

## Simulated Events

The EventEngine creates generated market events, sector events, ticker events, earnings-like events, volatility shocks, and liquidity shocks. Each event has impact values for sentiment, demand, liquidity, and volatility. Impacts decay over ticks.

Important honesty point:

> These are generated simulation inputs. They are not real news, real earnings, or recommendations.

## Candles

The backend now keeps OHLCV candles: open, high, low, close, volume, simulated date/time, session, and volatility regime. Scenario history can still use simple close prices, but internally the market has candle context.

## Benchmark Indexes

StockBreakers calculates simulated indexes such as `SBX_TOTAL` and sector benchmarks. Portfolio performance can now be compared against the generated market instead of only raw gain/loss.

## Order Engine Integration

The server still owns execution:

- market buy fills near ask plus slippage
- market sell fills near bid minus slippage
- limit buy waits until ask reaches the limit
- limit sell waits until bid reaches the limit
- pending buy limits reserve virtual cash
- pending sell limits reserve available shares
- cancelled, expired, or rejected pending orders release their reservation
- closed-market market orders reject clearly
- idempotency keys still prevent duplicate orders
- spread and slippage respond to liquidity, volatility, events, and session

Interview explanation:

> Pending orders introduced a double-spend problem. I solved it by reserving cash for pending buy limits and reserving shares for pending sell limits, then consuming or releasing those reservations when the order fills, cancels, expires, or rejects.

## Transaction-Ready Accounting

Order creation and order fills touch multiple collections: user cash, holdings, orders, transactions, trade plans, and equity snapshots. The order engine now runs those critical paths through a MongoDB transaction wrapper and passes the session into the writes.

Local Docker can use standalone MongoDB, where real transactions are unavailable. In that case, the wrapper detects the transaction capability error, logs a clear warning once, and runs the same accounting path without a session so the demo still works.

Interview explanation:

> The fill path is multi-document, so I made it transaction-ready with Mongoose sessions. Local standalone MongoDB falls back safely, while a replica-set production MongoDB can commit or abort the accounting changes together.

## Fallbacks

The app keeps defensive behavior: Socket.IO polling fallback, Express-to-FastAPI timeout, degraded scenario response, tick-loop try/catch, per-order pending processing protection, and browser fallback data for GitHub Pages demo mode.

## Why No Real Market APIs

StockBreakers intentionally avoids real broker APIs and paid market APIs. It is an educational simulator, not a trading product. This avoids compliance, billing, rate-limit, and data-licensing issues while still showing strong full-stack architecture.

## Limitations

- Generated market data is not calibrated to real historical data.
- Simulated events are template-based.
- Candles are in-memory.
- Benchmarks are simple averages.
- The app is not suitable for real investment decisions.
