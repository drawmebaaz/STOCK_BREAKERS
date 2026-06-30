import React, { useCallback, useEffect, useMemo, useState } from "react";
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
      const { data } = await api.get("/transactions?limit=200");
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

  const enrichedTransactions = useMemo(() => {
    const positions = new Map();
    const detailsById = new Map();
    const chronological = [...transactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    chronological.forEach((transaction) => {
      const current = positions.get(transaction.ticker) || { quantity: 0, costBasis: 0 };

      if (transaction.type === "buy") {
        const next = {
          quantity: current.quantity + transaction.quantity,
          costBasis: +(current.costBasis + transaction.total).toFixed(2),
        };
        positions.set(transaction.ticker, next);
        detailsById.set(transaction._id, {
          realizedPnl: null,
          avgCostBefore: null,
          positionAfter: next.quantity,
        });
        return;
      }

      const avgCost = current.quantity > 0 ? current.costBasis / current.quantity : transaction.price;
      const matchedQty = Math.min(transaction.quantity, current.quantity);
      const realizedPnl = transaction.realizedPnl ?? +((transaction.price - avgCost) * matchedQty).toFixed(2);
      const nextQty = Math.max(0, current.quantity - transaction.quantity);
      const nextCostBasis = nextQty > 0 ? +(current.costBasis - avgCost * matchedQty).toFixed(2) : 0;

      positions.set(transaction.ticker, { quantity: nextQty, costBasis: nextCostBasis });
      detailsById.set(transaction._id, {
        realizedPnl,
        avgCostBefore: +avgCost.toFixed(4),
        positionAfter: nextQty,
      });
    });

    return transactions.map((transaction) => ({
      ...transaction,
      ...(detailsById.get(transaction._id) || {}),
    }));
  }, [transactions]);

  const filtered = useMemo(
    () => (filter === "all"
      ? enrichedTransactions
      : enrichedTransactions.filter((transaction) => transaction.type === filter)),
    [enrichedTransactions, filter]
  );

  const totalBought = enrichedTransactions
    .filter((transaction) => transaction.type === "buy")
    .reduce((sum, transaction) => sum + transaction.total, 0);
  const totalSold = enrichedTransactions
    .filter((transaction) => transaction.type === "sell")
    .reduce((sum, transaction) => sum + transaction.total, 0);
  const sells = enrichedTransactions.filter((transaction) => transaction.type === "sell");
  const realizedPnl = sells.reduce((sum, transaction) => sum + Number(transaction.realizedPnl || 0), 0);
  const winningSells = sells.filter((transaction) => Number(transaction.realizedPnl || 0) > 0).length;
  const sellWinRate = sells.length > 0 ? (winningSells / sells.length) * 100 : 0;
  const lastTrade = enrichedTransactions[0]?.createdAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Trade history</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Past Trades</h1>
          <p className="mt-1 text-sm text-slate-500">A clear record of every practice buy and sell.</p>
        </div>
        <button onClick={loadTransactions} disabled={loading} className="btn-ghost">
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric label="Total orders" value={enrichedTransactions.length} />
        <Metric label="Spent on buys" value={currency(totalBought)} tone="negative" />
        <Metric label="Received from sells" value={currency(totalSold)} tone="positive" />
        <Metric
          label="Closed gain/loss"
          value={`${realizedPnl >= 0 ? "+" : ""}${currency(realizedPnl)}`}
          sub={sells.length > 0 ? `${sells.length} closed sell orders` : "No sells yet"}
          tone={realizedPnl >= 0 ? "positive" : "negative"}
        />
        <Metric
          label="Sell win rate"
          value={`${sellWinRate.toFixed(0)}%`}
          sub={lastTrade ? new Date(lastTrade).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "No fills yet"}
          tone={sellWinRate >= 50 ? "positive" : "neutral"}
        />
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Trade History</h2>
            <p className="section-subtitle mt-1">
              {filtered.length} rows in this view. Closed gain/loss is rebuilt from the latest 200 trades.
            </p>
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
                  filter === item.id ? "bg-[#c6a15b] text-[#08111f]" : "text-slate-500 hover:text-slate-200"
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
                  <th>Stock</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Closed Gain/Loss</th>
                  <th className="text-right">Slippage</th>
                  <th className="text-right">After</th>
                  <th>Timestamp</th>
                  <th>Order</th>
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
                    <td className="text-right mono">{currency(transaction.fillPrice || transaction.price)}</td>
                    <td className="text-right mono font-semibold">
                      <span className={transaction.type === "buy" ? "text-red-300" : "text-emerald-300"}>
                        {transaction.type === "buy" ? "-" : "+"}{currency(transaction.total)}
                      </span>
                    </td>
                    <td className="text-right mono">
                      {transaction.type === "sell" && transaction.realizedPnl !== null && transaction.realizedPnl !== undefined ? (
                        <span className={transaction.realizedPnl >= 0 ? "text-emerald-300" : "text-red-300"}>
                          {transaction.realizedPnl >= 0 ? "+" : ""}{currency(transaction.realizedPnl)}
                        </span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>
                    <td className="text-right mono text-slate-500">
                      {transaction.slippage !== undefined && transaction.slippage !== null ? currency(transaction.slippage) : "--"}
                    </td>
                    <td className="text-right mono text-slate-500">
                      {transaction.positionAfter ?? "--"}
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
                    <td className="mono text-xs text-slate-600">
                      {String(transaction.orderId || transaction._id).slice(-8).toUpperCase()}
                    </td>
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
