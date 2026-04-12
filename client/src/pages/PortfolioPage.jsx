import React from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { usePortfolioStore, usePriceStore } from "../stores/index.js";
import { usePortfolio } from "../hooks/index.js";

const COLORS = ["#22c55e","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#ec4899","#84cc16"];

export default function PortfolioPage() {
  const { holdings, summary, loading } = usePortfolioStore();
  const { refresh } = usePortfolio();
  const priceMap = usePriceStore((s) => s.priceMap);

  // Enrich holdings with live price
  const enriched = holdings.map((h) => ({
    ...h,
    currentPrice: priceMap[h.ticker] ?? h.currentPrice,
    currentValue: (priceMap[h.ticker] ?? h.currentPrice) * h.quantity,
  }));

  const pieData = enriched.map((h) => ({
    name: h.ticker, value: +h.currentValue.toFixed(2),
  }));

  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading portfolio…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <button onClick={refresh} className="btn-ghost text-sm">Refresh</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Value",   value: `$${fmt(summary.totalValue)}` },
            { label: "Cash",          value: `$${fmt(summary.cash)}` },
            { label: "Invested",      value: `$${fmt(summary.totalInvested)}` },
            {
              label: "Total P&L",
              value: `${summary.pnl >= 0 ? "+" : ""}$${fmt(summary.pnl)}`,
              color: summary.pnl >= 0 ? "text-green-400" : "text-red-400",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="card">
              <p className="stat-label mb-1">{label}</p>
              <p className={`stat-value ${color ?? ""}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation pie */}
        {pieData.length > 0 && (
          <div className="card lg:col-span-1">
            <h2 className="font-medium mb-4">Allocation</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Holdings table */}
        <div className="card lg:col-span-2 p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-medium">Holdings</h2>
          </div>
          {enriched.length === 0 ? (
            <p className="text-gray-500 text-sm p-6 text-center">No holdings yet. Go trade!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                    {["Ticker","Qty","Avg Cost","Current","Value","P&L"].map((h) => (
                      <th key={h} className="px-4 py-2 text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((h) => {
                    const pnl = h.currentValue - h.totalInvested;
                    const pnlPct = (pnl / h.totalInvested) * 100;
                    return (
                      <tr key={h.ticker} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-medium">{h.ticker}</td>
                        <td className="px-4 py-3 text-right">{h.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">${h.avgCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">${h.currentPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">${h.currentValue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={pnl >= 0 ? "text-green-400" : "text-red-400"}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}<br />
                            <span className="text-xs">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
