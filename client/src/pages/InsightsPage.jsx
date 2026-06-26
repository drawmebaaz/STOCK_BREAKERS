import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function RiskMeter({ label, color }) {
  const toneClass = {
    green: "text-emerald-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[color] || "text-slate-200";

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Risk Level</h2>
        <span className="badge-neutral">Practice view</span>
      </div>
      <div className="mt-5 rounded-md border border-slate-800 bg-[#0b121a] p-4">
        <p className={`text-3xl font-semibold ${toneClass}`}>{label}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">Based on recent price swings and drops.</p>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Higher means the stock has moved around more sharply in the recent sample.
      </p>
    </div>
  );
}

function ResearchTakeaway({ risk }) {
  const metrics = risk?.metrics || {};
  const swing = Number(metrics.ann_volatility || 0);
  const drop = Number(metrics.max_drawdown || 0);
  const downDays = Number(metrics.downside_probability || 0);

  const swingText = swing >= 35 ? "large" : swing >= 20 ? "moderate" : "mild";
  const dropText = Math.abs(drop) >= 12 ? "watch the downside before taking a large position" : "recent drops look manageable for a practice trade";
  const downText = downDays >= 50 ? "down days are showing up often" : "up and down days look fairly balanced";

  return (
    <div className="panel p-4">
      <h2 className="section-title">What To Notice</h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
        <p>The recent price movement looks <span className="font-medium text-slate-200">{swingText}</span>.</p>
        <p>The biggest recent drop suggests you should <span className="font-medium text-slate-200">{dropText}</span>.</p>
        <p>In the recent sample, <span className="font-medium text-slate-200">{downText}</span>.</p>
      </div>
    </div>
  );
}

function SentimentPanel({ sentiment, headlines }) {
  const cfg = {
    bullish: { badge: "badge-up", label: "Bullish" },
    bearish: { badge: "badge-down", label: "Bearish" },
    neutral: { badge: "badge-neutral", label: "Neutral" },
  }[sentiment] || { badge: "badge-neutral", label: "Neutral" };

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Signal Summary</h2>
          <p className="section-subtitle mt-1">
            Practice signal based on recent price movement.
          </p>
        </div>
        <span className={cfg.badge}>{cfg.label}</span>
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
    { title: "Moving Up", items: suggestions.trending_up || [], tone: "positive" },
    { title: "Pullback Ideas", items: suggestions.dip_buys || [], tone: "warning" },
  ];

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Stock Ideas</h2>
          <p className="section-subtitle mt-1">Simple practice scans from the current price movement.</p>
        </div>
        <span className="badge-neutral">Practice only</span>
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
                          </span>
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
    {
      day: 0,
      historical: historicalPrices.at(-1),
      p5: historicalPrices.at(-1),
      p25: historicalPrices.at(-1),
      p50: historicalPrices.at(-1),
      p75: historicalPrices.at(-1),
      p95: historicalPrices.at(-1),
    },
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
      setError(err.response?.data?.error || "Research service is unavailable. Please try again in a moment.");
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
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Price Forecast & Risk Review</h1>
          <p className="mt-1 text-sm text-slate-500">Run a practice forecast, compare possible price ranges, and review risk before trading.</p>
        </div>
        <button onClick={runAnalysis} disabled={loading || stocks.length === 0} className="btn-primary">
          {loading ? "Checking" : "Review Stock"}
        </button>
      </div>

      <div className="panel p-4">
        <h2 className="section-title">Analysis Settings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label>
            <span className="stat-label mb-1 block">Stock</span>
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
            <span className="stat-label mb-1 block">Review depth</span>
            <select className="input" value={sims} onChange={(event) => setSims(+event.target.value)}>
              {[
                { label: "Quick", value: 100 },
                { label: "Standard", value: 500 },
                { label: "Deeper check", value: 1000 },
              ].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
            <p className="stat-label">Current price</p>
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
            <p>Choose a stock and run an analysis to see the forecast panel.</p>
            <p className="text-xs">The simulator uses backend price history to create practice comparisons.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="panel p-6">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            Checking recent price history for {ticker}.
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
              label="Middle estimate"
              value={currency(stats?.median_final)}
              sub={signedPercent(medianMove, 1)}
              tone={medianMove >= 0 ? "positive" : "negative"}
            />
            <StatCard label="Low estimate" value={currency(stats?.p5_final)} tone="negative" />
            <StatCard label="High estimate" value={currency(stats?.p95_final)} tone="positive" />
            <StatCard
              label="Chance above today"
              value={`${stats?.prob_gain ?? 0}%`}
              tone={(stats?.prob_gain ?? 0) >= 50 ? "positive" : "negative"}
            />
            <StatCard label="Risk level" value={result.risk.label} tone="warning" />
          </div>

          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{ticker} Forecast Range</h2>
                <p className="section-subtitle mt-1">
                  {horizon}-day practice view using {result.history?.points || result.prices.length} recent price points.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#7ba8d8]" />Past price</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#c6a15b]" />Middle</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#e06f70]" />Range</span>
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
                  <Line dataKey="historical" stroke="#7ba8d8" strokeWidth={2} dot={false} name="Past price" connectNulls />
                  <Line dataKey="p95" stroke="#68c8c3" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="High range" connectNulls />
                  <Line dataKey="p75" stroke="#7ba8d8" strokeWidth={1} dot={false} strokeDasharray="3 3" name="Upper range" connectNulls />
                  <Line dataKey="p50" stroke="#bc9042" strokeWidth={2.2} dot={false} name="Middle" connectNulls />
                  <Line dataKey="p25" stroke="#c9973f" strokeWidth={1} dot={false} strokeDasharray="3 3" name="Lower range" connectNulls />
                  <Line dataKey="p5" stroke="#dc6b69" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="Low range" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <SentimentPanel {...result.sentiment} />
            <RiskMeter label={result.risk.label} color={result.risk.color} />
          </div>

          {result.risk.metrics && <ResearchTakeaway risk={result.risk} />}
        </>
      )}
    </div>
  );
}
