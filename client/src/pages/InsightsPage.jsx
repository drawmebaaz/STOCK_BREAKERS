import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowUpRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePriceStore } from "../stores/index.js";
import { api } from "../utils/api.js";
import { currency, signedPercent } from "../utils/format.js";

function StatCard({ label, value, sub, tone = "neutral" }) {
  const toneClass = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    info: "text-sky-300",
    neutral: "text-slate-50",
  }[tone];

  return (
    <div className="metric-card">
      <p className="stat-label">{label}</p>
      <p className={`stat-value mt-1 ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function RiskMeter({ score, label, color }) {
  const colorMap = { green: "#52c78a", amber: "#d6a84f", red: "#f26d6d" };
  const fill = colorMap[color] || "#95a3b7";

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Risk Score</h2>
        <span className="badge-neutral">{label}</span>
      </div>
      <div className="mt-5 flex items-center justify-center">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2937" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={fill}
              strokeDasharray={`${(score / 100) * 251.2} 251.2`}
              strokeLinecap="round"
              strokeWidth="10"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mono text-3xl font-semibold" style={{ color: fill }}>{score}</span>
            <span className="stat-label">of 100</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Score blends annual volatility and drawdown to frame position risk for education.
      </p>
    </div>
  );
}

function SentimentPanel({ sentiment, confidence, headlines, source }) {
  const cfg = {
    bullish: { badge: "badge-up", label: "Bullish" },
    bearish: { badge: "badge-down", label: "Bearish" },
    neutral: { badge: "badge-neutral", label: "Neutral" },
  }[sentiment] || { badge: "badge-neutral", label: "Neutral" };

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Signal Sentiment</h2>
          <p className="section-subtitle mt-1">
            Confidence-weighted simulated tape signal{source ? ` from ${source.replaceAll("_", " ")}` : ""}.
          </p>
        </div>
        <span className={cfg.badge}>{cfg.label} {Math.round((confidence ?? 0) * 100)}%</span>
      </div>

      {headlines?.length > 0 ? (
        <div className="mt-4 divide-y divide-slate-800 rounded-md border border-slate-800 bg-slate-950/50">
          {headlines.slice(0, 4).map((headline, index) => (
            <div key={`${headline}-${index}`} className="px-3 py-2 text-sm text-slate-300">
              {headline}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No signal notes were returned for this run.</p>
      )}
    </div>
  );
}

function SuggestionsPanel({ suggestions, priceMap, onTrade }) {
  if (!suggestions) {
    return (
      <div className="panel p-4">
        <div className="skeleton h-5 w-36" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </div>
    );
  }

  const groups = [
    { title: "Momentum Screen", items: suggestions.trending_up || [], tone: "positive" },
    { title: "Pullback Screen", items: suggestions.dip_buys || [], tone: "warning" },
  ];

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Quant Screeners</h2>
          <p className="section-subtitle mt-1">Rules-based candidates from current simulated tape.</p>
        </div>
        <span className="badge-neutral">Education only</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="rounded-md border border-slate-800 bg-slate-950/50">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
              <span className="badge-neutral">{group.items.length}</span>
            </div>

            {group.items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No candidates in this scan.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {group.items.slice(0, 4).map((item) => {
                  const live = priceMap[item.ticker] ?? item.price;
                  const isUp = item.change >= 0;

                  return (
                    <button
                      key={`${group.title}-${item.ticker}`}
                      onClick={() => onTrade(item.ticker)}
                      className="w-full px-3 py-3 text-left transition-colors hover:bg-slate-900"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <span className="ticker-chip">{item.ticker}</span>
                          <span className={isUp ? "ml-2 badge-up" : "ml-2 badge-down"}>
                            {signedPercent(item.change)}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-right">
                            <span className="mono block text-sm text-slate-100">{currency(live)}</span>
                            {item.score !== undefined && <span className="block text-xs text-slate-500">Score {item.score}</span>}
                          </span>
                          <ArrowUpRight size={15} className="text-slate-500" />
                        </span>
                      </span>
                      {item.rationale && (
                        <span className="mt-2 block text-xs leading-5 text-slate-500">{item.rationale}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildChartData(historicalPrices, forecast) {
  const hist = historicalPrices.slice(-30).map((price, i) => ({
    day: -(30 - i),
    historical: +price.toFixed(2),
  }));

  const future = forecast.p50.map((_, i) => ({
    day: i + 1,
    p5: forecast.p5[i],
    p25: forecast.p25[i],
    p50: forecast.p50[i],
    p75: forecast.p75[i],
    p95: forecast.p95[i],
  }));

  return [
    ...hist,
    { day: 0, historical: historicalPrices.at(-1), p50: historicalPrices.at(-1) },
    ...future,
  ];
}

export default function InsightsPage() {
  const stocks = usePriceStore((s) => s.stocks);
  const priceMap = usePriceStore((s) => s.priceMap);
  const navigate = useNavigate();

  const [ticker, setTicker] = useState("AAPL");
  const [horizon, setHorizon] = useState(30);
  const [sims, setSims] = useState(500);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState("");

  const selectedStock = useMemo(() => stocks.find((stock) => stock.ticker === ticker), [stocks, ticker]);
  const livePrice = priceMap[ticker] ?? selectedStock?.price;

  useEffect(() => {
    api.get("/ai/suggestions")
      .then(({ data }) => setSuggestions(data))
      .catch(() => setSuggestions({ trending_up: [], dip_buys: [] }));
  }, []);

  useEffect(() => {
    if (stocks.length > 0 && !stocks.some((stock) => stock.ticker === ticker)) {
      setTicker(stocks[0].ticker);
    }
  }, [stocks, ticker]);

  useEffect(() => {
    setResult(null);
    setError("");
  }, [ticker, horizon, sims]);

  const runAnalysis = async () => {
    const price = priceMap[ticker] ?? selectedStock?.price;
    if (!price) {
      setError("Market stream is still connecting for this symbol.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data: history } = await api.get(`/ai/history/${ticker}`);
      const prices = history.prices;
      const [predRes, sentRes, riskRes] = await Promise.all([
        api.post("/ai/predict", { ticker, prices, horizon, simulations: sims }),
        api.post("/ai/sentiment", { ticker }),
        api.post("/ai/risk", { ticker, prices }),
      ]);
      setResult({ predict: predRes.data, sentiment: sentRes.data, risk: riskRes.data, prices, history });
      api.get("/ai/suggestions").then(({ data }) => setSuggestions(data)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || "Research service is unavailable. Check the ML service and try again.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = result ? buildChartData(result.prices, result.predict.forecast) : [];
  const stats = result?.predict?.stats;
  const analysisPrice = result?.prices?.at(-1) ?? livePrice;
  const medianMove = result && analysisPrice ? ((stats?.median_final - analysisPrice) / analysisPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Research lab</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Forecast & Risk Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Monte Carlo paths, sentiment confidence, and risk decomposition for paper trading decisions.</p>
        </div>
        <button onClick={runAnalysis} disabled={loading || stocks.length === 0} className="btn-primary">
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <Activity size={15} />}
          {loading ? "Running" : "Run Analysis"}
        </button>
      </div>

      <div className="panel p-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-slate-500" />
          <h2 className="section-title">Scenario Controls</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label>
            <span className="stat-label mb-1 block">Instrument</span>
            <select className="input" value={ticker} onChange={(event) => setTicker(event.target.value)}>
              {stocks.map((stock) => (
                <option key={stock.ticker} value={stock.ticker}>{stock.ticker} - {stock.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="stat-label mb-1 block">Horizon</span>
            <select className="input" value={horizon} onChange={(event) => setHorizon(+event.target.value)}>
              {[7, 14, 30, 60, 90].map((days) => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <label>
            <span className="stat-label mb-1 block">Simulations</span>
            <select className="input" value={sims} onChange={(event) => setSims(+event.target.value)}>
              {[100, 250, 500, 1000].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
            <p className="stat-label">Live mark</p>
            <p className="mono mt-1 text-lg font-semibold text-slate-50">{currency(livePrice)}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedStock?.sector || "Market stream"}</p>
          </div>
        </div>
      </div>

      <SuggestionsPanel suggestions={suggestions} priceMap={priceMap} onTrade={(symbol) => navigate(`/trade/${symbol}`)} />

      {error && <div className="alert-error">{error}</div>}

      {!result && !loading && (
        <div className="panel">
          <div className="empty-state min-h-64">
            <p>Choose an instrument and run an analysis to populate the forecast panel.</p>
            <p className="text-xs">The simulator uses backend-maintained price history with bootstrap resampling for educational comparison.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="panel p-6">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            Loading backend history and running {sims} simulations for {ticker}.
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard label="Current price" value={currency(result.prices.at(-1))} />
            <StatCard
              label="Median close"
              value={currency(stats?.median_final)}
              sub={signedPercent(medianMove, 1)}
              tone={medianMove >= 0 ? "positive" : "negative"}
            />
            <StatCard label="5th percentile" value={currency(stats?.p5_final)} tone="negative" />
            <StatCard label="95th percentile" value={currency(stats?.p95_final)} tone="positive" />
            <StatCard
              label="Gain probability"
              value={`${stats?.prob_gain ?? 0}%`}
              tone={(stats?.prob_gain ?? 0) >= 50 ? "positive" : "negative"}
            />
            <StatCard label="Ann. volatility" value={`${stats?.ann_volatility ?? 0}%`} tone="warning" />
          </div>

          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{ticker} Monte Carlo Bands</h2>
                <p className="section-subtitle mt-1">
                  {horizon}-day horizon across {sims} paths using {result.history?.points || result.prices.length} backend price points.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#7aa7d9]" />Historical</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#52c78a]" />Median</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#f26d6d]" />Tail</span>
              </div>
            </div>

            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 14, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#1b2533" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#657386" }}
                    tickFormatter={(value) => (value === 0 ? "Now" : value > 0 ? `+${value}d` : `${value}d`)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#657386" }}
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                    width={58}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#101620",
                      border: "1px solid #243041",
                      borderRadius: 8,
                      color: "#edf2f7",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [currency(value), name]}
                    labelFormatter={(label) => (label === 0 ? "Now" : label > 0 ? `Day +${label}` : `Day ${label}`)}
                  />
                  <ReferenceLine x={0} stroke="#243041" strokeDasharray="4 4" />
                  <Line dataKey="historical" stroke="#7aa7d9" strokeWidth={2} dot={false} name="Historical" connectNulls />
                  <Line dataKey="p95" stroke="#9b8bd8" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="95th pct" connectNulls />
                  <Line dataKey="p75" stroke="#86d7b0" strokeWidth={1} dot={false} strokeDasharray="3 3" name="75th pct" connectNulls />
                  <Line dataKey="p50" stroke="#52c78a" strokeWidth={2.2} dot={false} name="Median" connectNulls />
                  <Line dataKey="p25" stroke="#d6a84f" strokeWidth={1} dot={false} strokeDasharray="3 3" name="25th pct" connectNulls />
                  <Line dataKey="p5" stroke="#f26d6d" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="5th pct" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <SentimentPanel {...result.sentiment} />
            <RiskMeter score={result.risk.score} label={result.risk.label} color={result.risk.color} />
          </div>

          {result.risk.metrics && (
            <div className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">Risk Breakdown</h2>
                  <p className="section-subtitle mt-1">Volatility, drawdown, and risk-adjusted return proxies.</p>
                </div>
                <span className="badge-neutral">Bootstrap model</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: "Annual volatility", value: `${result.risk.metrics.ann_volatility}%`, tone: "warning" },
                  { label: "Max drawdown", value: `${result.risk.metrics.max_drawdown}%`, tone: "negative" },
                  { label: "Sharpe ratio", value: result.risk.metrics.sharpe, tone: "info" },
                  { label: "Daily VaR 95", value: `${result.risk.metrics.var_95 ?? 0}%`, tone: "negative" },
                  { label: "Daily CVaR 95", value: `${result.risk.metrics.cvar_95 ?? 0}%`, tone: "negative" },
                  { label: "Down days", value: `${result.risk.metrics.downside_probability ?? 0}%`, tone: "warning" },
                ].map((item) => (
                  <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
                ))}
              </div>
              {result.predict.metadata && (
                <p className="mt-4 text-xs text-slate-600">
                  Model: {result.predict.metadata.model}; input points: {result.predict.metadata.input_points};
                  reproducible seed: {result.predict.metadata.seed}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
