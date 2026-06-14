# Building StockBreakers: Problems Faced and How I Solved Them

StockBreakers started as an idea for a realistic educational paper-trading platform. I did not want it to feel like a generic finance dashboard with a few charts. The goal was to build a complete full-stack system where a user could sign in, monitor simulated prices, place virtual trades, track holdings, review a transaction ledger, and run quantitative risk analysis.

This write-up explains the main technical and product problems I faced while building the project from scratch, and how each one was solved.

## 1. Defining the Right Architecture

The first problem was deciding how to split the system. A single backend could have handled everything, but that would make the project less realistic and harder to explain as a production-style platform.

I separated the project into four main services:

- React frontend for the trading workspace
- Express API for auth, trading, portfolio, watchlist, and ledger workflows
- MongoDB for persisted user, holding, and transaction data
- FastAPI ML service for forecasting, risk, sentiment, and screeners

This made the architecture cleaner because trading state and quantitative analysis became separate concerns. The Express API owns authenticated application logic, while FastAPI owns numerical computation.

## 2. Making Simulated Trading Feel Safe

A normal buy/sell form is easy to build, but it can feel careless. In a trading simulator, users need clarity before they confirm an order.

The first version of the order ticket only asked for ticker and quantity. That was not enough. A user could enter a large quantity without understanding buying power, position impact, or whether the price had moved after review.

I improved the order flow with:

- Cash-balance validation
- Max affordable quantity for buy orders
- Max sellable quantity for sell orders
- Position-after-order preview
- Buying-power usage percentage
- Two-step order review and confirmation
- Stale-price protection if the simulated price changes after review

This changed the trade desk from a basic form into a safer trading workflow.

## 3. Keeping Real-Time Prices Synchronized

The next challenge was live price updates. I wanted the app to feel alive, but real market APIs add complexity, cost, and API-key issues. Since this is an educational simulator, I built a simulated price engine.

The Express server updates prices every 4 seconds and broadcasts them through Socket.IO. The frontend stores the latest prices in Zustand so dashboard tables, portfolio values, trade tickets, and analytics screens can stay synchronized.

The challenge here was avoiding mismatched values. If the dashboard showed one price and the trade ticket used another, the app would feel unreliable.

I solved this by making the backend price store the source of truth and deriving `priceMap` on the frontend from the latest Socket.IO payload.

## 4. Handling Portfolio Accounting

Portfolio accounting was more subtle than it first looked. Buying stock is easy: subtract cash and add quantity. The tricky part is maintaining average cost, invested amount, unrealized P&L, and correct behavior after partial sells.

The solution was to store holdings separately from transactions:

- Holdings track current quantity, average cost, and invested capital.
- Transactions track every buy and sell fill.
- Portfolio summary recomputes live value using current prices.
- The ledger reconstructs realized practice P&L from transaction history.

This made the platform more useful because the ledger is not just a history table. It also helps users understand whether their simulated exits were profitable.

## 5. Avoiding Fake ML

One of the biggest issues appeared in the research analytics module.

Initially, the frontend generated a random synthetic price history in the browser and sent that to the ML service. It worked technically, but it was misleading. A forecast based on browser-random data is not a trustworthy analytics pipeline.

I fixed this by moving price history ownership to the backend.

The current flow is:

1. The backend price engine maintains rolling simulated price history for every ticker.
2. The frontend calls `GET /api/ai/history/:ticker`.
3. Express validates the ticker and returns backend-maintained history.
4. The frontend sends that history to the FastAPI ML service.
5. FastAPI runs bootstrap Monte Carlo simulation and returns model metadata.

This made the ML pipeline more honest and easier to explain.

## 6. Making Monte Carlo Results Reproducible

Another issue with the ML service was randomness. Monte Carlo simulation naturally uses random sampling, but if the same input produces completely different results every time, it becomes hard to debug and hard to trust.

I solved this by adding deterministic seeds based on:

- Ticker
- Number of input points
- Latest price
- Forecast horizon
- Simulation count

Now the service can return a reproducible seed with the prediction metadata. This is useful for debugging and makes the analytics feel more professional.

## 7. Improving Risk Metrics

The early risk module used volatility, drawdown, and a Sharpe-like ratio. These were useful, but incomplete.

A trading analytics project should communicate downside risk more directly, so I added:

- VaR 95
- CVaR 95
- Downside probability
- Annualized volatility
- Maximum drawdown
- Sharpe-like ratio

This made the research page more quantitative and gave users a better picture of downside exposure.

## 8. Being Honest About Sentiment

A major product concern was the word "AI." It is easy to overclaim by showing fake news headlines or pretending the app has real market sentiment.

The early sentiment output looked too much like real analyst/news sentiment, even though the app uses simulated signals. That could mislead users and interviewers.

I changed the wording to "simulated signal sentiment" and made the output transparent. Instead of pretending to read live news, the service returns signal notes and clearly labels the source as simulated market signal data.

This made the feature more honest and defensible.

## 9. Fixing CORS and Environment Configuration

Running multiple services created environment issues. The frontend, backend, and ML service all needed to talk to each other in both local development and Docker.

Common issues included:

- Wrong API URLs in `.env`
- CORS mismatches between frontend and backend
- Socket.IO origin issues
- Different URLs in Docker vs local dev

I solved this by separating environment variables clearly:

- `CLIENT_URL`
- `CORS_ORIGINS`
- `ML_SERVICE_URL`
- `VITE_API_URL`
- `VITE_SOCKET_URL`

The Docker setup uses internal service names, while local development uses localhost ports.

## 10. Docker and Port Conflicts

Docker made deployment cleaner, but it also introduced practical issues.

I faced problems such as:

- Docker Desktop not running
- Containers restarting with stale images
- Port 3000 already being used by another local project
- The frontend container not exposing the expected port when another app occupied it

The solution was to:

- Check Docker health before running compose commands
- Rebuild images after frontend/backend changes
- Use Vite dev server on port 5173 when port 3000 was occupied
- Keep API and ML services reachable on ports 5000 and 8000

This also taught me to separate "the app works" from "the app works on this exact port." The system should be verifiable even when a local port is busy.

## 11. The Temporary Live Link Problem

During development, I used a Cloudflare quick tunnel to create a shareable link. It was useful for quick demos, but it was temporary.

The problem was that the link stopped working when:

- The local Docker stack stopped
- The tunnel process stopped
- The machine disconnected

The fix was to document the limitation clearly. For a permanent production link, the app should be deployed on a real hosting setup with a managed database and persistent backend services.

## 12. UI Redesign Problems

The first UI looked like a normal dashboard. It worked, but it did not feel like a serious trading simulator.

The redesign focused on:

- Dark-first trading workspace
- Compact data tables
- Professional numeric formatting
- Controlled green/red financial accents
- Clear separation between dashboard, trade desk, portfolio, research, and ledger
- Mobile-friendly navigation

One issue I hit during styling was trying to reuse custom component classes too aggressively in Tailwind. Some classes could not be composed the way I initially wrote them, so I duplicated a few small style rules inside the CSS component layer instead of forcing a fragile abstraction.

## 13. The Currency Formatting Bug

One real bug appeared in the portfolio page. I used a helper to format currency, but one caller passed `maximumFractionDigits: 0` while the helper still defaulted `minimumFractionDigits` to 2.

That caused this JavaScript error:

```text
RangeError: maximumFractionDigits value is out of range
```

The fix was to make the formatter defensive:

```js
const maximumFractionDigits = options.maximumFractionDigits ?? 2;
const minimumFractionDigits = Math.min(options.minimumFractionDigits ?? 2, maximumFractionDigits);
```

This made the formatter safe for both full currency values and rounded summary badges.

## 14. Encoding and Broken Characters

At one point, some UI text contained broken characters such as mojibake symbols. These came from copied arrow and punctuation characters being interpreted incorrectly.

I fixed this by scanning the source for broken characters and replacing decorative symbols with plain text or proper icon components.

This mattered because broken symbols make a project feel unfinished, especially in a resume/demo context.

## 15. Empty States and Demo Data

A trading platform looks weak if the portfolio, ledger, and charts are empty in a demo. But hardcoding fake holdings into the UI would be dishonest.

I solved this by adding a demo seed script and using real simulated trades:

- Seed demo user
- Place sample paper buys
- Place a partial sell
- Let portfolio and ledger populate from real backend flows

This keeps screenshots and demos meaningful without bypassing the actual system.

## 16. README and Documentation Drift

As the project evolved, the README became outdated. It still described older assumptions and did not explain the improved ML pipeline.

I updated the README to include:

- Current architecture
- Docker and local setup
- ML pipeline details
- Risk metrics
- API surface
- Screenshots
- Production notes

I also removed resume-style bullets from the README because the README should explain the project, not act like a resume section.

## Final Result

The final StockBreakers system is stronger because the difficult parts were treated seriously:

- Real authentication instead of mock login
- Backend-owned trading and portfolio state
- Socket.IO live market simulation
- Safer order review and stale-price protection
- Backend-maintained price history for analytics
- Reproducible Monte Carlo forecasts
- Transparent simulated signal sentiment
- VaR/CVaR/downside risk analytics
- Dockerized multi-service deployment
- README screenshots and documentation

The biggest lesson was that a resume project becomes much stronger when the hidden engineering is real. A polished UI helps, but the interviewer will care more about whether the data flow, failure handling, architecture, and tradeoffs make sense.
