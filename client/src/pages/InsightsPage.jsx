import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { usePriceStore } from "../stores/index.js";
import { api } from "../utils/api.js";

const HISTORY_LEN = 60;
const fmt2 = (n) => Number(n).toFixed(2);

function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="card">
      <p className="stat-label mb-1">{label}</p>
      <p className={`stat-value ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function RiskMeter({ score, label, color }) {
  const colorMap = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444" };
  const fill = colorMap[color] || "#6b7280";
  return (
    <div className="card flex flex-col items-center justify-center py-6 gap-3">
      <p className="stat-label">Risk score</p>
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="12" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={fill} strokeWidth="12"
            strokeDasharray={`${(score / 100) * 251.2} 251.2`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: fill }}>{score}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color: fill }}>{label} Risk</span>
    </div>
  );
}

function SentimentBadge({ sentiment, confidence, headlines }) {
  const cfg = {
    bullish: { color: "text-green-400", bg: "bg-green-400/10", arrow: "↑" },
    bearish: { color: "text-red-400",   bg: "bg-red-400/10",   arrow: "↓" },
    neutral: { color: "text-gray-400",  bg: "bg-gray-400/10",  arrow: "→" },
  }[sentiment] || {};
  return (
    <div className="card space-y-3">
      <p className="stat-label">Market sentiment</p>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg}`}>
        <span className={`text-xl font-bold ${cfg.color}`}>{cfg.arrow}</span>
        <span className={`text-lg font-semibold capitalize ${cfg.color}`}>{sentiment}</span>
        <span className="text-xs text-gray-500">({Math.round(confidence * 100)}% conf.)</span>
      </div>
      {headlines?.length > 0 && (
        <ul className="space-y-1.5 mt-1">
          {headlines.map((h, i) => (
            <li key={i} className="text-xs text-gray-400 flex gap-2">
              <span className="text-gray-600">▸</span>{h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionsCard({ suggestions, priceMap, onTrade }) {
  if (!suggestions) return null;
  const { trending_up = [], dip_buys = [] } = suggestions;
  if (trending_up.length === 0 && dip_buys.length === 0) return null;

  return (
    <div className="card">
      <h2 className="font-medium mb-4">AI suggestions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Trending up */}
        {trending_up.length > 0 && (
          <div>
            <p className="text-xs text-green-400 font-medium uppercase tracking-wide mb-3">
              ↑ Momentum picks
            </p>
            <div className="space-y-2">
              {trending_up.map((s) => {
                const live = priceMap[s.ticker] ?? s.price;
                return (
                  <div key={s.ticker}
                    className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                    <div>
                      <span className="font-medium text-sm">{s.ticker}</span>
                      <span className="text-xs text-green-400 ml-2">+{s.change.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">${live.toFixed(2)}</span>
                      <button
                        onClick={() => onTrade(s.ticker)}
                        className="text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 px-2 py-1 rounded transition-colors">
                        Trade ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dip buys */}
        {dip_buys.length > 0 && (
          <div>
            <p className="text-xs text-amber-400 font-medium uppercase tracking-wide mb-3">
              ↓ Dip opportunities
            </p>
            <div className="space-y-2">
              {dip_buys.map((s) => {
                const live = priceMap[s.ticker] ?? s.price;
                return (
                  <div key={s.ticker}
                    className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                    <div>
                      <span className="font-medium text-sm">{s.ticker}</span>
                      <span className="text-xs text-red-400 ml-2">{s.change.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">${live.toFixed(2)}</span>
                      <button
                        onClick={() => onTrade(s.ticker)}
                        className="text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 px-2 py-1 rounded transition-colors">
                        Trade ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-4">
        Momentum picks = stocks with highest positive change not in your watchlist.
        Dip opportunities = biggest drops — potential mean-reversion buys.
      </p>
    </div>
  );
}

function buildChartData(historicalPrices, forecast) {
  const hist = historicalPrices.slice(-30).map((price, i) => ({
    day: -(30 - i), historical: +price.toFixed(2),
  }));
  const future = forecast.p50.map((_, i) => ({
    day: i + 1,
    p5:  forecast.p5[i],  p25: forecast.p25[i],
    p50: forecast.p50[i], p75: forecast.p75[i], p95: forecast.p95[i],
  }));
  return [...hist, { day: 0, historical: historicalPrices.at(-1), p50: historicalPrices.at(-1) }, ...future];
}

function syntheticHistory(currentPrice, len = HISTORY_LEN) {
  const prices = [currentPrice];
  for (let i = 1; i < len; i++) {
    const prev = prices[0];
    const drift = (Math.random() - 0.48) * 0.015;
    prices.unshift(+(prev / (1 + drift)).toFixed(2));
  }
  return prices;
}

export default function InsightsPage() {
  const stocks   = usePriceStore((s) => s.stocks);
  const priceMap = usePriceStore((s) => s.priceMap);
  const navigate = (ticker) => window.location.href = `/trade/${ticker}`;

  const [ticker,   setTicker]   = useState("AAPL");
  const [horizon,  setHorizon]  = useState(30);
  const [sims,     setSims]     = useState(500);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [error,    setError]    = useState("");

  // Load suggestions on mount
  useEffect(() => {
    api.get("/ai/suggestions")
      .then(({ data }) => setSuggestions(data))
      .catch(() => {});
  }, []);

  const runAnalysis = async () => {
    const price = priceMap[ticker];
    if (!price) return;
    setLoading(true);
    setError("");
    setResult(null);
    const prices = syntheticHistory(price, HISTORY_LEN);
    try {
      const [predRes, sentRes, riskRes] = await Promise.all([
        api.post("/ai/predict",   { ticker, prices, horizon, simulations: sims }),
        api.post("/ai/sentiment", { ticker }),
        api.post("/ai/risk",      { ticker, prices }),
      ]);
      setResult({ predict: predRes.data, sentiment: sentRes.data, risk: riskRes.data, prices });
      // Refresh suggestions after analysis
      api.get("/ai/suggestions").then(({ data }) => setSuggestions(data)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || "ML service unavailable. Is it running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (result) runAnalysis(); }, [ticker]);

  const chartData = result ? buildChartData(result.prices, result.predict.forecast) : [];
  const stats = result?.predict?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">AI Insights</h1>
          <p className="text-xs text-gray-500">Historical Bootstrap Monte Carlo · {sims} simulations</p>
        </div>
        <div className="flex flex-wrap gap-3 ml-auto items-end">
          <div>
            <p className="stat-label mb-1">Stock</p>
            <select className="input w-44" value={ticker} onChange={(e) => setTicker(e.target.value)}>
              {stocks.map((s) => <option key={s.ticker} value={s.ticker}>{s.ticker} — {s.name}</option>)}
            </select>
          </div>
          <div>
            <p className="stat-label mb-1">Horizon</p>
            <select className="input w-32" value={horizon} onChange={(e) => setHorizon(+e.target.value)}>
              {[7,14,30,60,90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div>
            <p className="stat-label mb-1">Simulations</p>
            <select className="input w-32" value={sims} onChange={(e) => setSims(+e.target.value)}>
              {[100,250,500,1000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={runAnalysis} disabled={loading} className="btn-primary h-10 px-6">
            {loading ? "Running…" : "Run Analysis ↻"}
          </button>
        </div>
      </div>

      {/* Suggestions always visible at top */}
      <SuggestionsCard suggestions={suggestions} priceMap={priceMap} onTrade={navigate} />

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!result && !loading && (
        <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
          <span className="text-5xl">✦</span>
          <p className="text-gray-400">Select a stock and click <strong>Run Analysis</strong> to generate a Monte Carlo forecast</p>
          <p className="text-xs text-gray-600">Uses historical bootstrap resampling — no normality assumption</p>
        </div>
      )}

      {loading && (
        <div className="card flex items-center justify-center py-20 gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Running {sims} simulations for {ticker}…
        </div>
      )}

      {result && (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Current price"   value={`$${fmt2(result.prices.at(-1))}`} />
            <StatCard label="Median forecast" value={`$${fmt2(stats?.median_final)}`}
              color={stats?.median_final >= result.prices.at(-1) ? "text-green-400" : "text-red-400"} />
            <StatCard label="5th pct (bear)"  value={`$${fmt2(stats?.p5_final)}`}  color="text-red-400" />
            <StatCard label="95th pct (bull)" value={`$${fmt2(stats?.p95_final)}`} color="text-green-400" />
            <StatCard label="Prob. of gain"   value={`${stats?.prob_gain}%`}
              color={stats?.prob_gain >= 50 ? "text-green-400" : "text-red-400"} />
            <StatCard label="Ann. volatility" value={`${stats?.ann_volatility}%`}  color="text-amber-400" />
          </div>

          {/* Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-medium">{ticker} — {horizon}-day Monte Carlo forecast</h2>
              <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-purple-400 inline-block"/>95th</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-400 inline-block"/>Median</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-red-400 inline-block"/>5th</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-400 inline-block"/>Historical</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickFormatter={(v) => v === 0 ? "Now" : v > 0 ? `+${v}d` : `${v}d`} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickFormatter={(v) => `$${v.toFixed(0)}`} width={60} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]}
                  labelFormatter={(l) => l === 0 ? "Now" : l > 0 ? `Day +${l}` : `Day ${l}`} />
                <ReferenceLine x={0} stroke="#374151" strokeDasharray="4 4" />
                <Line dataKey="historical" stroke="#60a5fa" strokeWidth={2} dot={false} name="Historical" connectNulls />
                <Line dataKey="p95"  stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="95th pct" connectNulls />
                <Line dataKey="p75"  stroke="#6ee7b7" strokeWidth={1}   dot={false} strokeDasharray="3 3" name="75th pct" connectNulls />
                <Line dataKey="p50"  stroke="#22c55e" strokeWidth={2}   dot={false} name="Median" connectNulls />
                <Line dataKey="p25"  stroke="#fcd34d" strokeWidth={1}   dot={false} strokeDasharray="3 3" name="25th pct" connectNulls />
                <Line dataKey="p5"   stroke="#f87171" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="5th pct" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sentiment + Risk */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2"><SentimentBadge {...result.sentiment} /></div>
            <RiskMeter score={result.risk.score} label={result.risk.label} color={result.risk.color} />
          </div>

          {/* Risk breakdown */}
          {result.risk.metrics && (
            <div className="card">
              <h2 className="font-medium mb-4">Risk breakdown</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Annualised volatility", value: `${result.risk.metrics.ann_volatility}%` },
                  { label: "Max drawdown",           value: `${result.risk.metrics.max_drawdown}%` },
                  { label: "Sharpe ratio",            value: result.risk.metrics.sharpe },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 rounded-lg px-4 py-3">
                    <p className="stat-label mb-1">{label}</p>
                    <p className="text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-4">
                Risk score = annualised volatility (60%) + max drawdown (40%).
                Forecast uses Historical Bootstrap Monte Carlo — real past returns resampled randomly,
                preserving fat tails without assuming normality.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
