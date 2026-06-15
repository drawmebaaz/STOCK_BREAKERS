import React from "react";
import { RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePortfolioStore, usePriceStore } from "../stores/index.js";
import { usePortfolio } from "../hooks/index.js";
import { currency, signedPercent } from "../utils/format.js";

const COLORS = ["#c6a15b", "#53d6d0", "#7ba8d8", "#4fbf86", "#d7a84d", "#e06f70", "#9aa8b8", "#c96d43"];

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

function AllocationRow({ item, total, color }) {
  const weight = total > 0 ? (item.value / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          <span className="ticker-chip">{item.name}</span>
        </div>
        <div className="text-right">
          <p className="mono text-slate-100">{currency(item.value)}</p>
          <p className="mono text-xs text-slate-500">{weight.toFixed(1)}%</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-900">
        <div className="h-full rounded-full" style={{ width: `${Math.min(weight, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function riskNoteFor(holding) {
  if (holding.weight >= 35) {
    return { label: "Concentrated", className: "badge-accent" };
  }
  if (holding.pnlPct <= -8) {
    return { label: "Drawdown", className: "badge-down" };
  }
  if (holding.pnlPct >= 8) {
    return { label: "Profit cushion", className: "badge-up" };
  }
  return { label: "Balanced", className: "badge-neutral" };
}

export default function PortfolioPage() {
  const { holdings, summary, loading, error } = usePortfolioStore();
  const { refresh } = usePortfolio();
  const priceMap = usePriceStore((s) => s.priceMap);
  const stocks = usePriceStore((s) => s.stocks);

  const baseEnriched = holdings.map((holding) => {
    const instrument = stocks.find((stock) => stock.ticker === holding.ticker);
    const currentPrice = priceMap[holding.ticker] ?? holding.currentPrice;
    const currentValue = currentPrice * holding.quantity;
    const pnl = currentValue - holding.totalInvested;
    const pnlPct = holding.totalInvested > 0 ? (pnl / holding.totalInvested) * 100 : 0;
    return {
      ...holding,
      company: instrument?.name || holding.ticker,
      sector: instrument?.sector || "Unclassified",
      currentPrice,
      currentValue,
      pnl,
      pnlPct,
    };
  });

  const invested = summary?.totalInvested ?? baseEnriched.reduce((sum, holding) => sum + holding.totalInvested, 0);
  const marketValue = summary?.stockValue ?? baseEnriched.reduce((sum, holding) => sum + holding.currentValue, 0);
  const cashReservePct = summary?.totalValue > 0 ? (summary.cash / summary.totalValue) * 100 : 0;
  const enriched = baseEnriched.map((holding) => {
    const weight = marketValue > 0 ? (holding.currentValue / marketValue) * 100 : 0;
    const enrichedHolding = { ...holding, weight };
    return { ...enrichedHolding, riskNote: riskNoteFor(enrichedHolding) };
  });
  const largest = enriched.reduce((max, holding) => Math.max(max, holding.currentValue), 0);
  const largestWeight = marketValue > 0 ? (largest / marketValue) * 100 : 0;
  const positivePositions = enriched.filter((holding) => holding.pnl >= 0).length;
  const pieData = enriched.map((holding) => ({
    name: holding.ticker,
    value: +holding.currentValue.toFixed(2),
  }));

  if (loading && holdings.length === 0) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20" />
        <div className="grid gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Portfolio control</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Holdings & Exposure</h1>
          <p className="mt-1 text-sm text-slate-500">Allocation, live valuation, concentration, and unrealized performance.</p>
        </div>
        <button onClick={refresh} className="btn-ghost">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Metric label="Total equity" value={currency(summary.totalValue)} />
          <Metric label="Virtual cash" value={currency(summary.cash)} />
          <Metric
            label="Cash reserve"
            value={`${cashReservePct.toFixed(1)}%`}
            sub="of total equity"
            tone={cashReservePct >= 20 ? "neutral" : "warning"}
          />
          <Metric label="Invested capital" value={currency(invested)} />
          <Metric
            label="Open P&L"
            value={`${summary.pnl >= 0 ? "+" : ""}${currency(summary.pnl)}`}
            sub={signedPercent(summary.pnlPct)}
            tone={summary.pnl >= 0 ? "positive" : "negative"}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Allocation Map</h2>
                <p className="section-subtitle mt-1">{enriched.length} open positions</p>
              </div>
              <span className="badge-neutral">{currency(marketValue, { maximumFractionDigits: 0 })}</span>
            </div>

            {pieData.length === 0 ? (
              <div className="empty-state min-h-64">
                <p>No active exposure.</p>
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="#101620" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => currency(value)}
                        contentStyle={{
                          background: "#101620",
                          border: "1px solid #243041",
                          borderRadius: 8,
                          color: "#edf2f7",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  {pieData.map((item, index) => (
                    <AllocationRow key={item.name} item={item} total={marketValue} color={COLORS[index % COLORS.length]} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="section-title">Position Quality</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <span className="text-xs text-slate-500">Winning positions</span>
                <span className="mono text-sm text-slate-100">{positivePositions}/{enriched.length || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <span className="text-xs text-slate-500">Largest weight</span>
                <span className={largestWeight > 35 ? "mono text-sm text-amber-300" : "mono text-sm text-slate-100"}>
                  {largestWeight.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <span className="text-xs text-slate-500">Cash reserve</span>
                <span className="mono text-sm text-[#c6a15b]">{currency(summary?.cash)}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="section-title">Holdings Ledger</h2>
              <p className="section-subtitle mt-1">Cost basis, live mark, value, and unrealized return.</p>
            </div>
            <span className="badge-neutral">{enriched.length} rows</span>
          </div>

          {enriched.length === 0 ? (
            <div className="empty-state">
              <p>No holdings yet. Open the Trade Desk when you are ready to place a simulated order.</p>
            </div>
          ) : (
            <div className="max-h-[680px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Sector</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Avg Cost</th>
                    <th className="text-right">Last</th>
                    <th className="text-right">Market Value</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">P&L</th>
                    <th className="text-right">Return</th>
                    <th className="text-right">Risk Note</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((holding) => (
                    <tr key={holding.ticker}>
                      <td>
                        <div>
                          <span className="ticker-chip">{holding.ticker}</span>
                          <p className="mt-2 text-xs text-slate-500">{holding.company}</p>
                        </div>
                      </td>
                      <td className="text-slate-500">{holding.sector}</td>
                      <td className="text-right mono">{holding.quantity}</td>
                      <td className="text-right mono">{currency(holding.avgCost)}</td>
                      <td className="text-right mono text-slate-100">{currency(holding.currentPrice)}</td>
                      <td className="text-right mono text-slate-100">{currency(holding.currentValue)}</td>
                      <td className="text-right mono text-slate-500">{holding.weight.toFixed(1)}%</td>
                      <td className="text-right">
                        <span className={holding.pnl >= 0 ? "text-emerald-300" : "text-red-300"}>
                          {holding.pnl >= 0 ? "+" : ""}{currency(holding.pnl)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={holding.pnl >= 0 ? "badge-up" : "badge-down"}>
                          {signedPercent(holding.pnlPct, 1)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={holding.riskNote.className}>{holding.riskNote.label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
