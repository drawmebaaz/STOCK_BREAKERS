import React, { useEffect, useState } from "react";
import { api } from "../utils/api.js";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | buy | sell

  useEffect(() => {
    api.get("/transactions")
      .then(({ data }) => setTransactions(data.transactions))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const totalBought = transactions.filter((t) => t.type === "buy").reduce((a, t) => a + t.total, 0);
  const totalSold   = transactions.filter((t) => t.type === "sell").reduce((a, t) => a + t.total, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Transaction History</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label mb-1">Total transactions</p>
          <p className="stat-value">{transactions.length}</p>
        </div>
        <div className="card">
          <p className="stat-label mb-1">Total bought</p>
          <p className="stat-value text-red-400">${totalBought.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="card">
          <p className="stat-label mb-1">Total sold</p>
          <p className="stat-value text-green-400">${totalSold.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "buy", "sell"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f ? "bg-green-600 text-white" : "btn-ghost"
            }`}
          >
            {f === "all" ? "All" : f === "buy" ? "Buys" : "Sells"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-gray-500 text-sm p-6 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm p-6 text-center">
            No {filter !== "all" ? filter : ""} transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                  {["Type", "Ticker", "Qty", "Price", "Total", "Date"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t._id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={t.type === "buy" ? "badge-up" : "badge-down"}>
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{t.ticker}</td>
                    <td className="px-4 py-3">{t.quantity}</td>
                    <td className="px-4 py-3 font-mono">${t.price.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-medium">
                      <span className={t.type === "buy" ? "text-red-400" : "text-green-400"}>
                        {t.type === "buy" ? "-" : "+"}${t.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(t.createdAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
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
