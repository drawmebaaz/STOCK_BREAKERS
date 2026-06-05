# StockBreakers

StockBreakers is a production-minded paper trading and stock analytics platform. It combines a premium React trading workspace, authenticated portfolio accounting, real-time simulated market data, and a FastAPI quantitative analytics service for Monte Carlo forecasting, downside risk, and signal-based research.

> Educational paper-trading app only. StockBreakers does not provide financial advice and does not execute real trades.

## Demo Access

Docker app:

```text
http://localhost:3000
```

Demo login:

```text
Email:    demo@stockbreakers.local
Password: DemoPass123!
```

Seed the demo account after the Docker stack is healthy:

```bash
docker compose exec server npm run seed:demo
```

## Why This Project Stands Out

- Full-stack trading simulator with real authentication, portfolio state, watchlists, order flow, and ledger history.
- Microservice architecture using React, Express/MongoDB, Socket.IO, FastAPI/NumPy, and Docker Compose.
- Backend-owned rolling price history, instead of browser-generated fake histories, powers ML and risk analytics.
- Quant analytics include bootstrap Monte Carlo forecasts, reproducible model seeds, VaR 95, CVaR 95, downside probability, volatility, drawdown, and Sharpe-like metrics.
- Secure, intentional trading UX with order review, max affordable/sellable quantity, buying-power usage, stale-price protection, and virtual-funds clarity.
- Production hardening includes JWT auth, Zod validation, Helmet, CORS configuration, rate limiting, health/readiness probes, Dockerized services, and Nginx frontend hosting.

## Core Features

Trading workspace:

- Real-time simulated market prices over Socket.IO
- Market watch with searchable instruments and watchlist controls
- Buy/sell order ticket with validation and confirmation flow
- Virtual cash accounting and position-after-order visibility
- Stale-price guard before confirming reviewed orders

Portfolio and ledger:

- Total equity, virtual cash, market value, and unrealized P&L
- Holdings table with average cost, live value, and return %
- Allocation chart and exposure breakdown
- Transaction ledger with buy/sell notional, realized practice P&L, sell win rate, position-after-fill, and fill references

Quant research:

- Backend-maintained rolling price history per ticker
- Bootstrap Monte Carlo forecast bands
- Median, 5th percentile, 95th percentile, gain probability, VaR, CVaR, downside probability, volatility, drawdown, and Sharpe-like metrics
- Simulated signal sentiment with transparent source labeling
- Momentum and pullback screeners with rationale and score

## Architecture

```text
Browser
  |-- React + Vite trading cockpit
  |-- Zustand state management
  |-- Recharts analytics visualizations
  |-- Socket.IO client for live prices
  v
Express API
  |-- Auth, trades, holdings, transactions, watchlist
  |-- Backend rolling price history
  |-- Zod validation and security middleware
  |-- MongoDB persistence
  v
FastAPI ML Service
  |-- Bootstrap Monte Carlo forecasts
  |-- Risk metrics: VaR, CVaR, volatility, drawdown, downside probability
  |-- Simulated signal sentiment and screeners
```

## Tech Stack

- Frontend: React 18, Vite 8, Tailwind CSS, Zustand, Recharts, Lucide
- Backend: Node.js 20+, Express, MongoDB, Mongoose, JWT, Socket.IO, Zod
- ML service: FastAPI, Pydantic 2, NumPy, Uvicorn
- Production/runtime: Docker Compose, Nginx, health checks, readiness checks

## ML Pipeline

StockBreakers uses a deliberately transparent ML pipeline suitable for an educational simulator:

1. The backend price engine maintains rolling simulated price history for every ticker.
2. The Insights screen requests that history through `GET /api/ai/history/:ticker`.
3. The Express API forwards validated analysis requests to the FastAPI ML service.
4. FastAPI runs historical bootstrap Monte Carlo simulation using a deterministic seed.
5. The response includes forecast bands, summary statistics, risk metrics, model metadata, and limitations.

Risk outputs include:

- Annualized volatility
- Maximum drawdown
- Sharpe-like ratio
- VaR 95
- CVaR 95
- Downside probability
- Gain probability
- Median forecast and percentile forecast bands

## Docker Compose

Create a root `.env` from `.env.example` and set a strong `JWT_SECRET`:

```bash
cp .env.example .env
docker compose up --build
```

Docker URLs:

```text
Client: http://localhost:3000
API:    http://localhost:5000/api/health
ML:     http://localhost:8000/health
```

Seed the demo user:

```bash
docker compose exec server npm run seed:demo
```

## Local Development

Start MongoDB locally, then create environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
cp ml-service/.env.example ml-service/.env
```

Run services in separate terminals:

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Local dev URLs:

```text
Client:     http://localhost:5173
API:        http://localhost:5000/api/health
API ready:  http://localhost:5000/api/ready
ML docs:    http://localhost:8000/docs
```

## Environment Variables

Backend:

```text
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/stockbreakers
JWT_SECRET=replace-with-a-64-character-random-secret
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=250
TRUST_PROXY=false
```

Frontend:

```text
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

ML service:

```text
CORS_ORIGINS=http://localhost:5173,http://localhost:5000
```

## API Surface

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Market and portfolio:

- `GET /api/stocks`
- `GET /api/stocks/:ticker`
- `POST /api/trade/buy`
- `POST /api/trade/sell`
- `GET /api/portfolio`
- `GET /api/portfolio/summary`
- `GET /api/transactions?limit=50`
- `POST /api/watchlist/add`
- `POST /api/watchlist/remove`

AI and research:

- `GET /api/ai/history/:ticker`
- `POST /api/ai/predict`
- `POST /api/ai/sentiment`
- `POST /api/ai/risk`
- `GET /api/ai/suggestions`

Ops:

- `GET /api/health`
- `GET /api/ready`
- `GET /health` on the ML service
- `GET /ready` on the ML service

## Quality Checks

```bash
cd client
npm run build
```

```bash
cd server
npm run audit:prod
```

```bash
cd ml-service
python -m compileall main.py
```

## Resume Talking Points

- Built a Dockerized microservice paper-trading platform using React, Express, MongoDB, Socket.IO, FastAPI, and NumPy.
- Implemented real-time simulated market streaming with synchronized React/Zustand state for portfolio value, watchlists, order entry, and analytics views.
- Designed authenticated trading workflows with virtual cash checks, max order sizing, stale-price protection, transaction ledger, realized practice P&L, and holdings accounting.
- Developed a quantitative analytics service using backend-maintained rolling price history, bootstrap Monte Carlo forecasting, VaR/CVaR, downside probability, volatility, drawdown, and Sharpe-like metrics.
- Hardened APIs with JWT auth, Zod validation, rate limiting, CORS allowlists, Helmet security headers, Docker health checks, and readiness probes.
- Created a premium dark-mode trading dashboard with market watch, portfolio exposure, allocation charts, order ticket, transaction audit trail, and research analytics.

## Production Notes

- Never commit real `.env` files or database credentials.
- Rotate sample secrets before any hosted deployment.
- Use managed MongoDB with network allowlisting and backups for production.
- Keep `CLIENT_URL` and `CORS_ORIGINS` restricted to real domains.
- Use HTTPS and `TRUST_PROXY=true` behind a trusted reverse proxy.
- The market data and sentiment signals are simulated for education; do not present them as real financial predictions.
