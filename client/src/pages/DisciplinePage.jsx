import React, { useCallback, useEffect, useState } from "react";
import { api, apiErrorMessage } from "../utils/api.js";

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

export default function DisciplinePage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/discipline/summary");
      setSummary(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load discipline review"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const score = Number(summary?.weeklyDisciplineScore || 0);
  const scoreTone = score >= 75 ? "positive" : score >= 50 ? "warning" : "negative";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Review lab</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Discipline</h1>
          <p className="mt-1 text-sm text-slate-500">
            See whether your practice trades are planned, sized well, and reviewed honestly.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost">
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading && !summary ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-24" />)}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <Metric label="Discipline score" value={`${score}/100`} tone={scoreTone} />
            <Metric label="Planned trades" value={summary.plannedTrades} sub={`${summary.planAdherenceRate}% of filled orders`} />
            <Metric label="Stop-loss used" value={summary.tradesWithStopLoss} />
            <Metric label="Oversized trades" value={summary.oversizedTrades || summary.overSizedTrades || 0} tone={(summary.oversizedTrades || summary.overSizedTrades) > 0 ? "warning" : "neutral"} />
            <Metric label="Main issue" value={summary.biggestBehaviorLeak} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="panel overflow-hidden">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="section-title">Setup Review</h2>
                <p className="section-subtitle mt-1">Simple patterns from the trade plans you created.</p>
              </div>
              {summary.setupPerformance?.length ? (
                <div className="overflow-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Setup</th>
                        <th className="text-right">Trades</th>
                        <th className="text-right">Reward/risk</th>
                        <th className="text-right">Oversized</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.setupPerformance.map((item) => (
                        <tr key={item.setupType}>
                          <td>{item.setupType.replace("_", " ")}</td>
                          <td className="mono text-right">{item.trades}</td>
                          <td className="mono text-right">{Number(item.averageRewardRisk || 0).toFixed(2)}x</td>
                          <td className="mono text-right">{item.oversized}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No planned trades yet. Add a risk plan from the Trade Desk to make this useful.</p>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="panel p-4">
                <h2 className="section-title">What To Work On</h2>
                <div className="mt-4 space-y-3">
                  {(summary.recommendationCards || []).map((card) => (
                    <div key={card.id} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm leading-6 text-slate-300">
                      {card.text}
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-4">
                <h2 className="section-title">Quick Counts</h2>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Unplanned trades</span><span className="mono text-slate-200">{summary.unplannedTrades}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">No thesis</span><span className="mono text-slate-200">{summary.noThesisTrades}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Early exits</span><span className="mono text-slate-200">{summary.earlyExitCount}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Fast re-entry signals</span><span className="mono text-slate-200">{summary.revengeTradeSignals}</span></div>
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <div className="empty-state">No discipline data found.</div>
      )}
    </div>
  );
}
