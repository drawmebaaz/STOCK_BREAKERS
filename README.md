# StockBreakers

StockBreakers is a production-minded paper-trading platform with live simulated market data, portfolio accounting, authenticated trading, transaction history, and an AI insights service for Monte Carlo forecasts, sentiment signals, risk scoring, and opportunity suggestions.

It is designed as a resume-ready full-stack project: React for the trading cockpit, Express and MongoDB for authenticated portfolio operations, Socket.IO for real-time prices, and FastAPI/NumPy for quantitative analysis.

> Educational paper-trading app only. It does not provide financial advice or execute real trades.

## Temporary Live Demo

Live app: https://listing-designed-prizes-sheets.trycloudflare.com

Demo login:

```text
Email:    demo@stockbreakers.local
Password: DemoPass123!
```

This demo is served through a free Cloudflare quick tunnel, so the link works while the local Docker stack and tunnel process are running.

## Highlights

- JWT authenticated accounts with persisted portfolio state
- Live simulated market stream over Socket.IO
- Buy/sell workflows with cash-balance checks and holdings accounting
- Watchlist, portfolio allocation, P&L, and transaction audit trail
- FastAPI ML microservice with bootstrap Monte Carlo forecasts
- Risk scoring from volatility, drawdown, and Sharpe-like metrics
- Sentiment and trade suggestion endpoints with graceful fallbacks
- Zod request validation across auth, trading, AI, and history APIs
- Helmet, CORS allowlists, rate limiting, JSON size limits, and readiness checks
- Dockerized React, Express, FastAPI, and MongoDB deployment path
- Clean responsive UI with mobile navigation and production build support

## Architecture

```text
Browser
  |-- React + Vite trading UI
  |-- Socket.IO live market stream
  v
Express API
  |-- Auth, trades, holdings, transactions, watchlist
  |-- Zod validation and security middleware
  |-- MongoDB persistence
  v
FastAPI ML Service
  |-- Monte Carlo forecast
  |-- Sentiment, risk, suggestions
```

## Tech Stack

- Frontend: React 18, Vite 8, Tailwind CSS, Zustand, Recharts, Lucide
- Backend: Node 20+, Express, MongoDB, Mongoose, JWT, Socket.IO, Zod
- ML service: FastAPI, Pydantic 2, NumPy, Uvicorn
- Production: Docker Compose, Nginx static hosting, health/readiness probes

## Local Development

Start MongoDB locally, then create environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
cp ml-service/.env.example ml-service/.env
```

Run the services in separate terminals:

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

Local URLs:

```text
Client:     http://localhost:5173
API:        http://localhost:5000/api/health
API ready:  http://localhost:5000/api/ready
ML docs:    http://localhost:8000/docs
```

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

Seed the demo account after the stack is healthy:

```bash
docker compose exec server npm run seed:demo
```

Demo login:

```text
Email:    demo@stockbreakers.local
Password: DemoPass123!
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

AI:

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
cd server
npm run audit:prod
```

```bash
cd client
npm run build
npm run audit:prod
```

```bash
cd ml-service
python -m compileall main.py
```

## Resume Talking Points

- Built a microservice architecture that separates real-time trading state from quantitative analysis.
- Implemented WebSocket market streaming and synchronized live prices into a React/Zustand cockpit.
- Hardened an Express API with CORS allowlists, rate limiting, structured validation, readiness probes, and Dockerized deployment.
- Designed portfolio accounting flows for cash balance, average cost, realized trade history, and allocation visualizations.
- Added a FastAPI ML service using bootstrap Monte Carlo simulation and risk metrics from volatility and drawdown.

## Production Notes

- Never commit real `.env` files or database credentials.
- Rotate the sample secret before running in production.
- Use managed MongoDB with network allowlisting and backups for hosted deployments.
- Keep `CLIENT_URL` and `CORS_ORIGINS` restricted to real domains.
- Use HTTPS and `TRUST_PROXY=true` when running behind a trusted reverse proxy.
