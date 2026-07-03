import React, { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePortfolioStore, usePriceStore } from "../stores/index.js";
import { usePortfolio } from "../hooks/index.js";
import { api } from "../utils/api.js";
import { currency, signedPercent } from "../utils/format.js";
import { chartColors, chartTooltipProps } from "../utils/chartTheme.js";

const COLORS = [
  chartColors.accent,
  chartColors.blue,
  chartColors.green,
  chartColors.amber,
  chartColors.red,
  chartColors.muted,
  chartColors.risk,
  chartColors.teal,
];

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

function SummaryItem({ label, value, sub, tone = "neutral" }) {
  const toneClass = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-slate-50",
  }[tone];

  return (
    <div className="min-w-0">
      <p className="stat-label">{label}</p>
      <p className={`mt-2 truncate text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p>}
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
  const analytics = usePortfolioStore((s) => s.analytics);
  const { refresh } = usePortfolio();
  const priceMap = usePriceStore((s) => s.priceMap);
  const stocks = usePriceStore((s) => s.stocks);
  const [indexes, setIndexes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get("/market/indexes")
      .then(({ data }) => {
        if (!cancelled) setIndexes(data.indexes || []);
      })
      .catch(() => {
        if (!cancelled) setIndexes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const totalIndex = indexes.find((index) => index.symbol === "SBX_TOTAL");
  const benchmarkReturn = Number(totalIndex?.dayChangePercent || 0);
  const reservedCash = Number(summary?.reservedCash || 0);
  const realizedTradeCount = Number(analytics?.realizedTradeCount || 0);
  const rMultipleCount = Number(analytics?.rMultipleCount || 0);
  const hasOpenRisk = Number(analytics?.openRiskAmount || 0) > 0;
  const hasDrawdown = Number(analytics?.maxDrawdown || 0) < 0;
  const showPerformancePanel = Boolean(analytics && (realizedTradeCount > 0 || rMultipleCount > 0 || hasOpenRisk || hasDrawdown));
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
          <p className="stat-label">Portfolio</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Holdings</h1>
          <p className="mt-1 text-sm text-slate-500">See what you own, what it is worth now, and how each holding is doing.</p>
        </div>
        <button onClick={refresh} className="btn-ghost">
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {summary && (
        <div className="panel p-4">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryItem label="Total equity" value={currency(summary.totalValue)} />
            <SummaryItem
              label={reservedCash > 0 ? "Available cash" : "Virtual cash"}
              value={currency(summary.availableCash ?? summary.cash)}
              sub={reservedCash > 0 ? `${currency(reservedCash)} reserved by pending orders` : `${cashReservePct.toFixed(1)}% of account`}
              tone={cashReservePct >= 20 ? "neutral" : "warning"}
            />
            <SummaryItem label="Invested" value={currency(invested)} />
            <SummaryItem
              label="Open gain/loss"
              value={`${summary.pnl >= 0 ? "+" : ""}${currency(summary.pnl)}`}
              sub={signedPercent(summary.pnlPct)}
              tone={summary.pnl >= 0 ? "positive" : "negative"}
            />
          </div>
          {totalIndex && (
            <div className="mt-4 border-t border-slate-800 pt-3 text-sm text-slate-500">
              Simulated market today:{" "}
              <span className={benchmarkReturn >= 0 ? "mono text-emerald-300" : "mono text-red-300"}>
                {signedPercent(benchmarkReturn, 1)}
              </span>
              . This is context only; portfolio gain/loss uses your open positions.
            </div>
          )}
        </div>
      )}

      {showPerformancePanel && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Performance Snapshot</h2>
              <p className="section-subtitle mt-1">Only metrics backed by your completed trade data are shown.</p>
            </div>
            {realizedTradeCount > 0 && <span className="badge-neutral">{realizedTradeCount} closed trades</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {realizedTradeCount > 0 && (
              <>
                <Metric
                  label="Closed gain/loss"
                  value={`${analytics.realizedPnl >= 0 ? "+" : ""}${currency(analytics.realizedPnl)}`}
                  tone={analytics.realizedPnl >= 0 ? "positive" : "negative"}
                />
                <Metric label="Win rate" value={`${Number(analytics.winRate || 0).toFixed(0)}%`} />
              </>
            )}
            {rMultipleCount > 0 && (
              <Metric label="Avg result vs planned risk" value={`${analytics.averageRMultiple.toFixed(2)}x`} />
            )}
            {hasDrawdown && (
              <Metric label="Biggest equity drop" value={`${Number(analytics.maxDrawdown || 0).toFixed(1)}%`} tone={analytics.maxDrawdown < -8 ? "warning" : "neutral"} />
            )}
            {hasOpenRisk && (
              <Metric label="Open planned risk" value={currency(analytics.openRiskAmount || 0)} sub={`${Number(analytics.openRiskPercent || 0).toFixed(1)}% of equity`} />
            )}
          </div>
        </div>
      )}

      {analytics?.riskWarnings?.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {analytics.riskWarnings[0]}
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Allocation</h2>
                <p className="section-subtitle mt-1">{enriched.length} open positions</p>
              </div>
              <span className="badge-neutral">{currency(marketValue, { maximumFractionDigits: 0 })}</span>
            </div>

            {pieData.length === 0 ? (
              <div className="empty-state min-h-64">
                <p>No holdings yet.</p>
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
                          <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="#0c131a" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...chartTooltipProps}
                        formatter={(value) => currency(value)}
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
            <h2 className="section-title">Position Check</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <span className="text-xs text-slate-500">Winning positions</span>
                <span className="mono text-sm text-slate-100">{positivePositions}/{enriched.length || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <span className="text-xs text-slate-500">Largest holding</span>
                <span className={largestWeight > 35 ? "mono text-sm text-amber-300" : "mono text-sm text-slate-100"}>
                  {largestWeight.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {analytics?.sectorExposure?.length > 0 && (
            <div className="panel p-4">
              <h2 className="section-title">Sector Exposure</h2>
              <div className="mt-4 space-y-3">
                {analytics.sectorExposure.slice(0, 5).map((item) => (
                  <div key={item.sector} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-400">{item.sector}</span>
                      <span className={item.warning ? "mono text-amber-300" : "mono text-slate-200"}>{item.weight.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-900">
                      <div className="h-full rounded-full bg-[#8eb3dc]" style={{ width: `${Math.min(item.weight, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="section-title">Holdings Table</h2>
              <p className="section-subtitle mt-1">Average cost, current price, value, and current return.</p>
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
                    <th>Stock</th>
                    <th>Sector</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Avg Cost</th>
                    <th className="text-right">Last</th>
                    <th className="text-right">Market Value</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Gain/Loss</th>
                    <th className="text-right">Return</th>
                    <th className="text-right">Status</th>
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
