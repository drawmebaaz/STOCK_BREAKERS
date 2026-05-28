import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { useAuthStore, usePriceStore, usePortfolioStore } from "../stores/index.js";
import { usePortfolio } from "../hooks/index.js";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency, signedPercent } from "../utils/format.js";

function SummaryCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="card">
      <p className="stat-label mb-1">{label}</p>
      <p className={`stat-value ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function PriceRow({ stock, onTrade, watchlist, onToggleWatch }) {
  const isUp = stock.change >= 0;
  const inWatch = watchlist.includes(stock.ticker);

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleWatch(stock.ticker)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              inWatch ? "text-yellow-300" : "text-gray-600 hover:bg-gray-800 hover:text-gray-300"
            }`}
            title={inWatch ? "Remove from watchlist" : "Add to watchlist"}
            aria-label={inWatch ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star size={16} fill={inWatch ? "currentColor" : "none"} />
          </button>
          <div>
            <p className="font-medium text-white">{stock.ticker}</p>
            <p className="text-xs text-gray-500">{stock.name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono">{currency(stock.price)}</td>
      <td className="px-4 py-3 text-right">
        <span className={isUp ? "badge-up" : "badge-down"}>{signedPercent(stock.change)}</span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-sm">{stock.sector}</td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => onTrade(stock.ticker)} className="text-xs btn-ghost py-1 px-3">
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
  usePortfolio();

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">Live paper market, watchlist, and portfolio snapshot</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Value" value={currency(summary.totalValue)} />
          <SummaryCard label="Cash" value={currency(summary.cash)} />
          <SummaryCard label="Stock Value" value={currency(summary.stockValue)} />
          <SummaryCard
            label="P&L"
            value={`${summary.pnl >= 0 ? "+" : ""}${currency(summary.pnl)}`}
            sub={signedPercent(summary.pnlPct)}
            color={summary.pnl >= 0 ? "text-green-300" : "text-red-300"}
          />
        </div>
      )}

      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-medium">Live Market</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
            <input
              className="input py-1.5 pl-9 text-sm"
              placeholder="Search ticker, company, sector"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="px-4 py-2 text-left">Stock</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Change</th>
                <th className="px-4 py-2 text-left">Sector</th>
                <th className="px-4 py-2 text-right">Action</th>
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
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            {stocks.length === 0 ? "Connecting to market stream..." : "No stocks match your search."}
          </p>
        )}
      </div>
    </div>
  );
}
