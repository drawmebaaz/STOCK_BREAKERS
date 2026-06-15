import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { useAuthStore, usePriceStore, usePortfolioStore } from "../stores/index.js";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency, signedPercent } from "../utils/format.js";

function Metric({ label, value, sub, tone = "neutral" }) {
  const toneClass = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
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

function PriceRow({ stock, onTrade, watchlist, onToggleWatch }) {
  const isUp = stock.change >= 0;
  const inWatch = watchlist.includes(stock.ticker);
  const activity = Math.min(99, Math.max(8, Math.round(Math.abs(stock.change) * 34 + 18)));

  return (
    <tr data-selected={inWatch ? "true" : undefined}>
      <td>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleWatch(stock.ticker)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
              inWatch
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-transparent text-slate-600 hover:border-slate-800 hover:text-slate-300"
            }`}
            title={inWatch ? "Remove from watchlist" : "Add to watchlist"}
            aria-label={inWatch ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star size={15} fill={inWatch ? "currentColor" : "none"} />
          </button>
          <div>
            <p className="ticker-chip">{stock.ticker}</p>
          </div>
        </div>
      </td>
      <td className="text-slate-400">{stock.name}</td>
      <td className="text-right mono text-slate-100">{currency(stock.price)}</td>
      <td className="text-right">
        <span className={isUp ? "badge-up" : "badge-down"}>{signedPercent(stock.change)}</span>
      </td>
      <td className="text-slate-500">{stock.sector}</td>
      <td>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-slate-900">
            <div className="h-full rounded-full bg-[#53d6d0]" style={{ width: `${activity}%` }} />
          </div>
          <span className="mono text-xs text-slate-500">{activity}</span>
        </div>
      </td>
      <td className="text-right">
        <button onClick={() => onTrade(stock.ticker)} className="btn-ghost px-3 py-1.5 text-xs">
          Trade
        </button>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const stocks = usePriceStore((s) => s.stocks);
  const summary = usePortfolioStore((s) => s.summary);
  const user = useAuthStore((s) => s.user);
  const updateWatchlist = useAuthStore((s) => s.updateWatchlist);
  const [watchlist, setWatchlist] = useState(user?.watchlist || []);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => {
      const nextWatchlist = data.user.watchlist || [];
      setWatchlist(nextWatchlist);
      updateWatchlist(nextWatchlist);
    }).catch(() => {});
  }, [updateWatchlist]);

  const toggleWatch = async (ticker) => {
    const inList = watchlist.includes(ticker);
    const nextWatchlist = inList ? watchlist.filter((item) => item !== ticker) : [...watchlist, ticker];
    setWatchlist(nextWatchlist);
    updateWatchlist(nextWatchlist);
    setError("");

    try {
      await api.post(`/watchlist/${inList ? "remove" : "add"}`, { ticker });
    } catch (err) {
      setWatchlist(watchlist);
      updateWatchlist(watchlist);
      setError(apiErrorMessage(err, "Could not update watchlist"));
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stocks;
    return stocks.filter(
      (stock) =>
        stock.ticker.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.sector.toLowerCase().includes(query)
    );
  }, [search, stocks]);

  const watchedStocks = stocks.filter((stock) => watchlist.includes(stock.ticker));
  const gainers = stocks.filter((stock) => stock.change >= 0).length;
  const decliners = stocks.filter((stock) => stock.change < 0).length;
  const strongest = [...stocks].sort((a, b) => b.change - a.change)[0];
  const weakest = [...stocks].sort((a, b) => a.change - b.change)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Trading workspace</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Portfolio Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track virtual capital, positions, live prices, and portfolio movement in one disciplined workspace.
          </p>
        </div>
        <button onClick={() => navigate("/trade")} className="btn-primary">
          Open Trade Desk
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label="Total equity" value={currency(summary.totalValue)} />
          <Metric label="Virtual cash" value={currency(summary.cash)} />
          <Metric label="Market value" value={currency(summary.stockValue)} />
          <Metric
            label="Unrealized P&L"
            value={`${summary.pnl >= 0 ? "+" : ""}${currency(summary.pnl)}`}
            sub={signedPercent(summary.pnlPct)}
            tone={summary.pnl >= 0 ? "positive" : "negative"}
          />
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="section-title">Market Watch</h2>
              <p className="section-subtitle mt-1">{stocks.length} simulated instruments streaming with activity signals</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
              <input
                className="input py-1.5 pl-9"
                placeholder="Search ticker, company, sector"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Company</th>
                  <th className="text-right">Last</th>
                  <th className="text-right">Move</th>
                  <th>Sector</th>
                  <th>Activity</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((stock) => (
                  <PriceRow
                    key={stock.ticker}
                    stock={stock}
                    watchlist={watchlist}
                    onTrade={(ticker) => navigate(`/trade/${ticker}`)}
                    onToggleWatch={toggleWatch}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              <p>{stocks.length === 0 ? "Connecting to market stream..." : "No instruments match your search."}</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="section-title">Market Breadth</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <p className="stat-label">Advancers</p>
                <p className="mono mt-1 text-lg font-semibold text-emerald-300">{gainers}</p>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <p className="stat-label">Decliners</p>
                <p className="mono mt-1 text-lg font-semibold text-red-300">{decliners}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Strongest tape</span>
                <span className="mono text-sm text-emerald-300">
                  {strongest ? `${strongest.ticker} ${signedPercent(strongest.change)}` : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Weakest tape</span>
                <span className="mono text-sm text-red-300">
                  {weakest ? `${weakest.ticker} ${signedPercent(weakest.change)}` : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Watchlist</h2>
              <span className="badge-neutral">{watchedStocks.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {watchedStocks.length === 0 ? (
                <p className="text-sm text-slate-500">Star instruments from Market Watch to monitor them here.</p>
              ) : (
                watchedStocks.map((stock) => (
                  <button
                    key={stock.ticker}
                    onClick={() => navigate(`/trade/${stock.ticker}`)}
                    className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                  >
                    <span>
                      <span className="ticker-chip">{stock.ticker}</span>
                      <span className="ml-2 text-xs text-slate-500">{stock.sector}</span>
                    </span>
                    <span className={stock.change >= 0 ? "badge-up" : "badge-down"}>
                      {signedPercent(stock.change)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
