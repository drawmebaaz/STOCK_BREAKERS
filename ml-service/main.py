from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import pandas as pd

app = FastAPI(title="StockBreakers ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ────────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    ticker: str
    prices: List[float]
    horizon: int = 30        # forecast days
    simulations: int = 500

class SentimentRequest(BaseModel):
    ticker: str
    text: Optional[str] = None

class RiskRequest(BaseModel):
    ticker: str
    prices: List[float]

class StockItem(BaseModel):
    ticker: str
    price: float
    change: float

class SuggestionRequest(BaseModel):
    watchlist: List[str] = []
    stocks: List[StockItem] = []


# ── Historical Bootstrap Monte Carlo ──────────────────────────────────────────
def bootstrap_monte_carlo(prices: List[float], horizon: int, simulations: int):
    """
    Core simulation:
    1. Compute historical log returns
    2. Resample returns randomly (with replacement) for each future step
    3. Chain into price paths
    4. Return percentile bands + stats
    """
    prices_arr = np.array(prices)
    log_returns = np.diff(np.log(prices_arr))

    if len(log_returns) < 5:
        raise HTTPException(status_code=400, detail="Need at least 6 price points")

    S0 = prices_arr[-1]
    paths = np.zeros((simulations, horizon + 1))
    paths[:, 0] = S0

    # Resample historical returns for all sims at once (vectorized)
    sampled = np.random.choice(log_returns, size=(simulations, horizon), replace=True)
    paths[:, 1:] = S0 * np.exp(np.cumsum(sampled, axis=1))

    finals = paths[:, -1]
    prob_gain = float(np.mean(finals > S0))

    # Annualised volatility from history
    ann_vol = float(np.std(log_returns) * np.sqrt(252) * 100)

    # Historical drift (mean daily log return annualised)
    ann_drift = float(np.mean(log_returns) * 252 * 100)

    # Percentile paths (day-by-day)
    p5  = np.percentile(paths, 5,  axis=0).tolist()
    p25 = np.percentile(paths, 25, axis=0).tolist()
    p50 = np.percentile(paths, 50, axis=0).tolist()
    p75 = np.percentile(paths, 75, axis=0).tolist()
    p95 = np.percentile(paths, 95, axis=0).tolist()

    # Sample of raw paths for visualisation (max 100)
    sample_n = min(simulations, 100)
    sample_paths = paths[:sample_n, :].tolist()

    return {
        "S0": round(S0, 2),
        "horizon": horizon,
        "simulations": simulations,
        "forecast": {
            "p5":  [round(v, 2) for v in p5],
            "p25": [round(v, 2) for v in p25],
            "p50": [round(v, 2) for v in p50],
            "p75": [round(v, 2) for v in p75],
            "p95": [round(v, 2) for v in p95],
        },
        "sample_paths": [[round(v, 2) for v in path] for path in sample_paths],
        "stats": {
            "median_final":   round(float(np.median(finals)), 2),
            "p5_final":       round(float(np.percentile(finals, 5)), 2),
            "p95_final":      round(float(np.percentile(finals, 95)), 2),
            "prob_gain":      round(prob_gain * 100, 1),
            "ann_volatility": round(ann_vol, 1),
            "ann_drift":      round(ann_drift, 1),
            "expected_return": round(float((np.median(finals) - S0) / S0 * 100), 2),
        },
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/predict")
def predict(req: PredictRequest):
    """Historical Bootstrap Monte Carlo prediction."""
    try:
        result = bootstrap_monte_carlo(req.prices, req.horizon, req.simulations)
        result["ticker"] = req.ticker
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sentiment")
def sentiment(req: SentimentRequest):
    """
    Mock sentiment — in production plug in a news API + FinBERT.
    Uses price momentum as a proxy signal for now.
    """
    # Deterministic seed from ticker so same ticker gets same result within a session
    seed = sum(ord(c) for c in req.ticker)
    rng = np.random.default_rng(seed % 1000)

    score = rng.uniform(-1, 1)
    if score > 0.25:
        label, emoji = "bullish", "↑"
    elif score < -0.25:
        label, emoji = "bearish", "↓"
    else:
        label, emoji = "neutral", "→"

    headlines = {
        "bullish": [
            f"{req.ticker} breaks resistance — analysts raise targets",
            f"Strong earnings beat lifts {req.ticker} sentiment",
            f"Institutional buying detected in {req.ticker}",
        ],
        "bearish": [
            f"{req.ticker} faces headwinds amid macro uncertainty",
            f"Profit-taking pressures {req.ticker} near highs",
            f"Options market signals caution on {req.ticker}",
        ],
        "neutral": [
            f"{req.ticker} consolidates ahead of earnings",
            f"Mixed signals for {req.ticker} — watch key levels",
            f"Analysts divided on {req.ticker} near-term outlook",
        ],
    }

    return {
        "ticker": req.ticker,
        "sentiment": label,
        "emoji": emoji,
        "score": round(float(score), 3),
        "confidence": round(abs(float(score)) * 0.4 + 0.5, 2),
        "headlines": headlines[label],
    }


@app.post("/risk")
def risk(req: RiskRequest):
    """
    Risk score 0-100 based on:
    - Annualised volatility (primary driver)
    - Max drawdown from the price series
    - Sharpe-like ratio
    """
    prices = np.array(req.prices)
    log_ret = np.diff(np.log(prices))

    ann_vol = np.std(log_ret) * np.sqrt(252)

    # Max drawdown
    cumulative = np.cumprod(1 + np.exp(log_ret) - 1)
    rolling_max = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - rolling_max) / rolling_max
    max_dd = abs(float(np.min(drawdown)))

    # Crude Sharpe (assuming 0 risk-free rate for simplicity)
    sharpe = float(np.mean(log_ret) / (np.std(log_ret) + 1e-9) * np.sqrt(252))

    # Risk score: higher vol + higher drawdown = higher score
    raw_score = (ann_vol * 100 * 0.6 + max_dd * 100 * 0.4)
    score = int(min(max(raw_score, 5), 95))

    if score < 30:
        label, color = "Low", "green"
    elif score < 60:
        label, color = "Moderate", "amber"
    else:
        label, color = "High", "red"

    return {
        "ticker": req.ticker,
        "score": score,
        "label": label,
        "color": color,
        "metrics": {
            "ann_volatility": round(ann_vol * 100, 1),
            "max_drawdown":   round(max_dd * 100, 1),
            "sharpe":         round(sharpe, 2),
        },
    }


@app.post("/suggestions")
def suggestions(req: SuggestionRequest):
    """
    Simple rule-based suggestions:
    - Stocks with positive change momentum
    - Not already in watchlist
    """
    watchlist_set = set(req.watchlist)
    candidates = [s for s in req.stocks if s.ticker not in watchlist_set]

    # Sort by positive change descending
    movers_up   = sorted([s for s in candidates if s.change > 0], key=lambda x: -x.change)[:3]
    movers_down = sorted([s for s in candidates if s.change < 0], key=lambda x: x.change)[:2]

    return {
        "trending_up":   [{"ticker": s.ticker, "price": s.price, "change": s.change} for s in movers_up],
        "dip_buys":      [{"ticker": s.ticker, "price": s.price, "change": s.change} for s in movers_down],
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "stockbreakers-ml"}
