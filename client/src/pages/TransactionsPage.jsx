import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency } from "../utils/format.js";

function Metric({ label, value, sub, tone = "neutral" }) {
  const toneClass = {
    positive: "text-emerald-300",
    negative: "text-red-300",
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/transactions");
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load transactions"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((transaction) => transaction.type === filter)),
    [filter, transactions]
  );

  const totalBought = transactions
    .filter((transaction) => transaction.type === "buy")
    .reduce((sum, transaction) => sum + transaction.total, 0);
  const totalSold = transactions
    .filter((transaction) => transaction.type === "sell")
    .reduce((sum, transaction) => sum + transaction.total, 0);
  const netCash = totalSold - totalBought;
  const lastTrade = transactions[0]?.createdAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Execution record</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Transaction Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">Auditable order trail for every simulated fill.</p>
        </div>
        <button onClick={loadTransactions} disabled={loading} className="btn-ghost">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Total orders" value={transactions.length} />
        <Metric label="Buy notional" value={currency(totalBought)} tone="negative" />
        <Metric label="Sell notional" value={currency(totalSold)} tone="positive" />
        <Metric
          label="Net cash flow"
          value={`${netCash >= 0 ? "+" : ""}${currency(netCash)}`}
          sub={lastTrade ? new Date(lastTrade).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "No fills yet"}
          tone={netCash >= 0 ? "positive" : "negative"}
        />
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Order History</h2>
            <p className="section-subtitle mt-1">{filtered.length} rows in current view.</p>
          </div>
          <div className="inline-flex rounded-md border border-slate-800 bg-slate-950/60 p-1">
            {[
              { id: "all", label: "All" },
              { id: "buy", label: "Buys" },
              { id: "sell", label: "Sells" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === item.id ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton h-10" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No orders match this view.</p>
          </div>
        ) : (
          <div className="max-h-[680px] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Side</th>
                  <th>Instrument</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Fill Price</th>
                  <th className="text-right">Notional</th>
                  <th>Timestamp</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>
                      <span className={transaction.type === "buy" ? "badge-up" : "badge-down"}>
                        {transaction.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="ticker-chip">{transaction.ticker}</span>
                    </td>
                    <td className="text-right mono">{transaction.quantity}</td>
                    <td className="text-right mono">{currency(transaction.price)}</td>
                    <td className="text-right mono font-semibold">
                      <span className={transaction.type === "buy" ? "text-red-300" : "text-emerald-300"}>
                        {transaction.type === "buy" ? "-" : "+"}{currency(transaction.total)}
                      </span>
                    </td>
                    <td className="text-slate-500">
                      {new Date(transaction.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="mono text-xs text-slate-600">{String(transaction._id).slice(-8).toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
