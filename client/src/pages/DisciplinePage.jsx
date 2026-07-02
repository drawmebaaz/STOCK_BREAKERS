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

function ScoreBar({ label, value, weight }) {
  const numeric = Number(value || 0);
  const tone = numeric >= 80 ? "bg-emerald-400" : numeric >= 55 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-medium text-slate-200">{label}</p>
          <p className="text-xs text-slate-500">{Math.round(Number(weight || 0) * 100)}% of score</p>
        </div>
        <span className="mono text-sm text-slate-100">{numeric.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-900">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, numeric))}%` }} />
      </div>
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
  const hasScore = summary?.weeklyDisciplineScore !== null && summary?.weeklyDisciplineScore !== undefined;
  const scoreTone = !hasScore ? "warning" : score >= 75 ? "positive" : score >= 50 ? "warning" : "negative";
  const breakdown = summary?.scoreBreakdown || {};
  const weights = breakdown.weights || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Review lab</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Discipline</h1>
          <p className="mt-1 text-sm text-slate-500">
            See whether your practice trades are planned, protected, sized safely, and reviewed after exit.
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
            <Metric
              label="Readiness"
              value={hasScore ? `${score}/100` : "Start first"}
              sub={summary.scoreLabel || "Not enough data"}
              tone={scoreTone}
            />
            <Metric label="Planned trades" value={summary.plannedTrades} sub={`${summary.planAdherenceRate}% of filled orders`} />
            <Metric label="Protected trades" value={summary.tradesWithStopLoss} sub="with stop-loss" />
            <Metric label="Oversized trades" value={summary.oversizedTrades || summary.overSizedTrades || 0} tone={(summary.oversizedTrades || summary.overSizedTrades) > 0 ? "warning" : "neutral"} />
            <Metric label="Main issue" value={summary.biggestBehaviorLeak} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <div className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="section-title">Why This Score</h2>
                    <p className="section-subtitle mt-1">
                      The score is based on habits, not profit. Small samples are marked with lower confidence.
                    </p>
                  </div>
                  <span className="badge-neutral">{summary.scoreConfidence || "LOW"} confidence</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{summary.scoreExplanation}</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ScoreBar label="Planning" value={breakdown.planning} weight={weights.planning} />
                  <ScoreBar label="Risk protection" value={breakdown.risk} weight={weights.risk} />
                  <ScoreBar label="Position size" value={breakdown.sizing} weight={weights.sizing} />
                  <ScoreBar label="Review habit" value={breakdown.review} weight={weights.review} />
                  <ScoreBar label="Calm behavior" value={breakdown.behavior} weight={weights.behavior} />
                </div>
              </div>

              <div className="panel overflow-hidden">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="section-title">Setup Review</h2>
                <p className="section-subtitle mt-1">Which type of trade plan is creating good or weak habits.</p>
              </div>
              {summary.setupPerformance?.length ? (
                <div className="overflow-auto">
                  <table className="data-table table-fixed">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[18%]" />
                      <col className="w-[24%]" />
                      <col className="w-[20%]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="align-middle">Setup</th>
                        <th className="text-right align-middle">Trades</th>
                        <th className="text-right align-middle">Reward/risk</th>
                        <th className="text-right align-middle">Oversized</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.setupPerformance.map((item) => (
                        <tr key={item.setupType}>
                          <td className="align-middle">{item.setupType.replace("_", " ")}</td>
                          <td className="mono text-right align-middle tabular-nums">{item.trades}</td>
                          <td className="mono text-right align-middle tabular-nums">{Number(item.averageRewardRisk || 0).toFixed(2)}x</td>
                          <td className="mono text-right align-middle tabular-nums">{item.oversized}</td>
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
            </div>

            <aside className="space-y-4">
              <div className="panel p-4">
                <h2 className="section-title">Before Next Order</h2>
                <div className="mt-4 space-y-2">
                  {(summary.nextTradeChecklist || []).map((item) => (
                    <div key={item} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm leading-6 text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

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
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Reviewed trades</span><span className="mono text-slate-200">{summary.reviewedTrades}</span></div>
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
