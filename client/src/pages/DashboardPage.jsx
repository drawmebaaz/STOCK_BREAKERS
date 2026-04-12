import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePriceStore, usePortfolioStore } from "../stores/index.js";
import { usePortfolio } from "../hooks/index.js";
import { api } from "../utils/api.js";

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
          <button onClick={() => onToggleWatch(stock.ticker)}
            className={`text-sm transition-colors ${inWatch ? "text-yellow-400" : "text-gray-600 hover:text-gray-400"}`}
            title={inWatch ? "Remove from watchlist" : "Add to watchlist"}>★</button>
          <div>
            <p className="font-medium text-white">{stock.ticker}</p>
            <p className="text-xs text-gray-500">{stock.name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono">${stock.price.toFixed(2)}</td>
      <td className="px-4 py-3 text-right">
        <span className={isUp ? "badge-up" : "badge-down"}>
          {isUp ? "+" : ""}{stock.change.toFixed(2)}%
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-sm">{stock.sector}</td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => onTrade(stock.ticker)}
          className="text-xs btn-ghost py-1 px-3">Trade</button>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const stocks = usePriceStore((s) => s.stocks);
  const summary = usePortfolioStore((s) => s.summary);
  const [watchlist, setWatchlist] = useState([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  usePortfolio();

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => setWatchlist(data.user.watchlist || []));
  }, []);

  const toggleWatch = async (ticker) => {
    const inList = watchlist.includes(ticker);
    if (inList) {
      await api.post("/watchlist/remove", { ticker });
      setWatchlist((w) => w.filter((t) => t !== ticker));
    } else {
      await api.post("/watchlist/add", { ticker });
      setWatchlist((w) => [...w, ticker]);
    }
  };

  const filtered = stocks.filter(
    (s) =>
      s.ticker.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Value"    value={`$${fmt(summary.totalValue)}`} />
          <SummaryCard label="Cash"           value={`$${fmt(summary.cash)}`} />
          <SummaryCard label="Stock Value"    value={`$${fmt(summary.stockValue)}`} />
          <SummaryCard
            label="P&L"
            value={`${summary.pnl >= 0 ? "+" : ""}$${fmt(summary.pnl)}`}
            sub={`${summary.pnlPct >= 0 ? "+" : ""}${summary.pnlPct?.toFixed(2)}%`}
            color={summary.pnl >= 0 ? "text-green-400" : "text-red-400"}
          />
        </div>
      )}

      {/* Stock table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="font-medium">Live Market</h2>
          <input
            className="input w-48 text-sm py-1.5"
            placeholder="Search ticker or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              {filtered.map((s) => (
                <PriceRow key={s.ticker} stock={s} watchlist={watchlist}
                  onTrade={(t) => navigate(`/trade/${t}`)}
                  onToggleWatch={toggleWatch} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
