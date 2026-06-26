import hashlib
import os
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5000")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["*"] if "*" in origins else origins


app = FastAPI(
    title="StockBreakers Research Service",
    version="1.0.0",
    description="Practice price ranges, risk labels, and stock ideas for StockBreakers.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class TickerModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    ticker: str = Field(..., min_length=1, max_length=8, pattern=r"^[A-Za-z.]+$")

    @field_validator("ticker")
    @classmethod
    def uppercase_ticker(cls, value: str) -> str:
        return value.upper()


class PredictRequest(TickerModel):
    prices: List[float] = Field(..., min_length=10, max_length=500)
    horizon: int = Field(30, ge=1, le=180)
    simulations: int = Field(500, ge=100, le=5000)

    @field_validator("prices")
    @classmethod
    def validate_prices(cls, value: list[float]) -> list[float]:
        arr = np.asarray(value, dtype=float)
        if not np.all(np.isfinite(arr)) or np.any(arr <= 0):
            raise ValueError("Prices must be finite positive numbers")
        return value


class SentimentRequest(TickerModel):
    text: Optional[str] = Field(default=None, max_length=5000)


class RiskRequest(TickerModel):
    prices: List[float] = Field(..., min_length=10, max_length=500)

    @field_validator("prices")
    @classmethod
    def validate_prices(cls, value: list[float]) -> list[float]:
        arr = np.asarray(value, dtype=float)
        if not np.all(np.isfinite(arr)) or np.any(arr <= 0):
            raise ValueError("Prices must be finite positive numbers")
        return value


class StockItem(TickerModel):
    price: float = Field(..., gt=0)
    change: float
    sector: Optional[str] = Field(default=None, max_length=80)


class SuggestionRequest(BaseModel):
    watchlist: List[str] = Field(default_factory=list, max_length=200)
    stocks: List[StockItem] = Field(default_factory=list, max_length=200)


def stable_seed(*parts: object) -> int:
    raw = "|".join(str(part) for part in parts).encode("utf-8")
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big") % (2**32)


def bootstrap_monte_carlo(ticker: str, prices: List[float], horizon: int, simulations: int):
    prices_arr = np.asarray(prices, dtype=float)
    log_returns = np.diff(np.log(prices_arr))

    if len(log_returns) < 5:
        raise HTTPException(status_code=400, detail="Need at least 6 price points")

    s0 = prices_arr[-1]
    seed = stable_seed(ticker, len(prices_arr), round(float(s0), 4), horizon, simulations)
    rng = np.random.default_rng(seed)
    paths = np.zeros((simulations, horizon + 1))
    paths[:, 0] = s0

    sampled = rng.choice(log_returns, size=(simulations, horizon), replace=True)
    paths[:, 1:] = s0 * np.exp(np.cumsum(sampled, axis=1))

    finals = paths[:, -1]
    final_returns = (finals - s0) / s0 * 100
    var_95 = float(np.percentile(final_returns, 5))
    tail_returns = final_returns[final_returns <= var_95]
    cvar_95 = float(np.mean(tail_returns)) if len(tail_returns) else var_95
    prob_gain = float(np.mean(finals > s0))
    ann_vol = float(np.std(log_returns) * np.sqrt(252) * 100)
    ann_drift = float(np.mean(log_returns) * 252 * 100)
    limitations = []
    if len(prices_arr) < 60:
        limitations.append("Short history window can make forecast bands unstable.")
    if ann_vol < 1:
        limitations.append("Very low observed volatility produces narrow forecast bands.")

    percentiles = {
        "p5": np.percentile(paths, 5, axis=0),
        "p25": np.percentile(paths, 25, axis=0),
        "p50": np.percentile(paths, 50, axis=0),
        "p75": np.percentile(paths, 75, axis=0),
        "p95": np.percentile(paths, 95, axis=0),
    }
    sample_paths = paths[: min(simulations, 100), :]

    return {
        "S0": round(float(s0), 2),
        "horizon": horizon,
        "simulations": simulations,
        "forecast": {
            key: [round(float(point), 2) for point in values]
            for key, values in percentiles.items()
        },
        "sample_paths": [[round(float(point), 2) for point in path] for path in sample_paths],
        "stats": {
            "median_final": round(float(np.median(finals)), 2),
            "p5_final": round(float(np.percentile(finals, 5)), 2),
            "p95_final": round(float(np.percentile(finals, 95)), 2),
            "prob_gain": round(prob_gain * 100, 1),
            "ann_volatility": round(ann_vol, 1),
            "ann_drift": round(ann_drift, 1),
            "expected_return": round(float((np.median(finals) - s0) / s0 * 100), 2),
            "var_95": round(var_95, 2),
            "cvar_95": round(cvar_95, 2),
            "downside_probability": round(float(np.mean(finals < s0) * 100), 1),
        },
        "metadata": {
            "model": "historical_bootstrap_monte_carlo",
            "input_points": len(prices_arr),
            "seed": seed,
            "limitations": limitations,
        },
    }


@app.post("/predict")
def predict(req: PredictRequest):
    result = bootstrap_monte_carlo(req.ticker, req.prices, req.horizon, req.simulations)
    result["ticker"] = req.ticker
    return result


@app.post("/sentiment")
def sentiment(req: SentimentRequest):
    seed = sum(ord(char) for char in req.ticker)
    rng = np.random.default_rng(seed % 1000)
    score = float(rng.uniform(-1, 1))

    if req.text:
        lower = req.text.lower()
        positive = sum(word in lower for word in ["beat", "growth", "upgrade", "profit", "strong"])
        negative = sum(word in lower for word in ["miss", "cut", "risk", "lawsuit", "weak"])
        score = float(np.clip(score + (positive - negative) * 0.15, -1, 1))

    if score > 0.25:
        label, direction = "bullish", "up"
    elif score < -0.25:
        label, direction = "bearish", "down"
    else:
        label, direction = "neutral", "flat"

    headlines = {
        "bullish": [
            f"{req.ticker} has been moving up in the recent practice prices",
            f"{req.ticker} looks stronger than neutral in this review",
            f"Check position size before placing a practice trade in {req.ticker}",
        ],
        "bearish": [
            f"{req.ticker} has been moving down in the recent practice prices",
            f"{req.ticker} looks weaker than neutral in this review",
            f"Consider a smaller practice trade if you choose {req.ticker}",
        ],
        "neutral": [
            f"{req.ticker} looks balanced in the recent practice prices",
            f"{req.ticker} does not show a strong direction in this review",
            f"Use the forecast range before deciding on {req.ticker}",
        ],
    }

    return {
        "ticker": req.ticker,
        "sentiment": label,
        "direction": direction,
        "score": round(score, 3),
        "confidence": round(abs(score) * 0.4 + 0.5, 2),
        "headlines": headlines[label],
        "source": "simulated_market_signal",
    }


@app.post("/risk")
def risk(req: RiskRequest):
    prices = np.asarray(req.prices, dtype=float)
    log_ret = np.diff(np.log(prices))
    volatility = float(np.std(log_ret))

    ann_vol = volatility * np.sqrt(252)
    rolling_max = np.maximum.accumulate(prices)
    drawdown = (prices - rolling_max) / rolling_max
    max_dd = abs(float(np.min(drawdown)))
    sharpe = 0.0 if volatility == 0 else float(np.mean(log_ret) / volatility * np.sqrt(252))
    returns_pct = (np.exp(log_ret) - 1) * 100
    var_95 = float(np.percentile(returns_pct, 5))
    tail_returns = returns_pct[returns_pct <= var_95]
    cvar_95 = float(np.mean(tail_returns)) if len(tail_returns) else var_95
    downside_probability = float(np.mean(returns_pct < 0) * 100)

    raw_score = ann_vol * 100 * 0.45 + max_dd * 100 * 0.35 + downside_probability * 0.2
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
            "max_drawdown": round(max_dd * 100, 1),
            "sharpe": round(sharpe, 2),
            "var_95": round(var_95, 2),
            "cvar_95": round(cvar_95, 2),
            "downside_probability": round(downside_probability, 1),
        },
    }


@app.post("/suggestions")
def suggestions(req: SuggestionRequest):
    watchlist_set = {ticker.upper() for ticker in req.watchlist}
    candidates = [stock for stock in req.stocks if stock.ticker not in watchlist_set]
    movers_up = sorted([stock for stock in candidates if stock.change > 0], key=lambda x: -x.change)[:3]
    movers_down = sorted([stock for stock in candidates if stock.change < 0], key=lambda x: x.change)[:2]

    return {
        "trending_up": [
            {
                "ticker": stock.ticker,
                "price": stock.price,
                "change": stock.change,
                "score": round(min(stock.change * 20, 100), 1),
                "rationale": "Recent practice prices are moving up.",
            }
            for stock in movers_up
        ],
        "dip_buys": [
            {
                "ticker": stock.ticker,
                "price": stock.price,
                "change": stock.change,
                "score": round(min(abs(stock.change) * 18, 100), 1),
                "rationale": "Recent practice prices are down, so review risk carefully.",
            }
            for stock in movers_down
        ],
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "stockbreakers-ml"}


@app.get("/ready")
def ready():
    return {"status": "ready"}
