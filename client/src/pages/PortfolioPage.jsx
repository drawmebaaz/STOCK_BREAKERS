import React from "react";
import { RefreshCw } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePortfolioStore, usePriceStore } from "../stores/index.js";
import { usePortfolio } from "../hooks/index.js";
import { currency, signedPercent } from "../utils/format.js";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function PortfolioPage() {
  const { holdings, summary, loading, error } = usePortfolioStore();
  const { refresh } = usePortfolio();
  const priceMap = usePriceStore((s) => s.priceMap);

  const enriched = holdings.map((holding) => {
    const currentPrice = priceMap[holding.ticker] ?? holding.currentPrice;
    const currentValue = currentPrice * holding.quantity;
    return { ...holding, currentPrice, currentValue };
  });

  const pieData = enriched.map((holding) => ({
    name: holding.ticker,
    value: +holding.currentValue.toFixed(2),
  }));

  if (loading && holdings.length === 0) {
    return <div className="text-gray-500 py-12 text-center">Loading portfolio...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Portfolio</h1>
          <p className="text-xs text-gray-500 mt-1">Allocation, live valuation, and unrealized P&L</p>
        </div>
        <button onClick={refresh} className="btn-ghost inline-flex items-center gap-2 text-sm">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Value", value: currency(summary.totalValue) },
            { label: "Cash", value: currency(summary.cash) },
            { label: "Invested", value: currency(summary.totalInvested) },
            {
              label: "Total P&L",
              value: `${summary.pnl >= 0 ? "+" : ""}${currency(summary.pnl)}`,
              sub: signedPercent(summary.pnlPct),
              color: summary.pnl >= 0 ? "text-green-300" : "text-red-300",
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card">
              <p className="stat-label mb-1">{label}</p>
              <p className={`stat-value ${color ?? ""}`}>{value}</p>
              {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {pieData.length > 0 && (
          <div className="card xl:col-span-1">
            <h2 className="font-medium mb-4">Allocation</h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={84}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => currency(value)}
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card xl:col-span-2 p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-medium">Holdings</h2>
          </div>
          {enriched.length === 0 ? (
            <p className="text-gray-500 text-sm p-8 text-center">No holdings yet. Place your first paper trade from the Trade tab.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                    {["Ticker", "Qty", "Avg Cost", "Current", "Value", "P&L"].map((header) => (
                      <th key={header} className="px-4 py-2 text-right first:text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((holding) => {
                    const pnl = holding.currentValue - holding.totalInvested;
                    const pnlPct = holding.totalInvested > 0 ? (pnl / holding.totalInvested) * 100 : 0;
                    return (
                      <tr key={holding.ticker} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-medium">{holding.ticker}</td>
                        <td className="px-4 py-3 text-right">{holding.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">{currency(holding.avgCost)}</td>
                        <td className="px-4 py-3 text-right font-mono">{currency(holding.currentPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono">{currency(holding.currentValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={pnl >= 0 ? "text-green-300" : "text-red-300"}>
                            {pnl >= 0 ? "+" : ""}{currency(pnl)}<br />
                            <span className="text-xs">({signedPercent(pnlPct, 1)})</span>
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
