import React, { useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency } from "../utils/format.js";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/transactions")
      .then(({ data }) => setTransactions(data.transactions))
      .catch((err) => setError(apiErrorMessage(err, "Could not load transactions")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? transactions : transactions.filter((transaction) => transaction.type === filter),
    [filter, transactions]
  );

  const totalBought = transactions.filter((transaction) => transaction.type === "buy").reduce((sum, transaction) => sum + transaction.total, 0);
  const totalSold = transactions.filter((transaction) => transaction.type === "sell").reduce((sum, transaction) => sum + transaction.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Transaction History</h1>
        <p className="text-xs text-gray-500 mt-1">Auditable order trail for all simulated trades</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label mb-1">Total transactions</p>
          <p className="stat-value">{transactions.length}</p>
        </div>
        <div className="card">
          <p className="stat-label mb-1">Total bought</p>
          <p className="stat-value text-red-300">{currency(totalBought)}</p>
        </div>
        <div className="card">
          <p className="stat-label mb-1">Total sold</p>
          <p className="stat-value text-green-300">{currency(totalSold)}</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="flex gap-2">
        {["all", "buy", "sell"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === item ? "bg-green-600 text-white" : "btn-ghost"
            }`}
          >
            {item === "all" ? "All" : item === "buy" ? "Buys" : "Sells"}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-gray-500 text-sm p-8 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm p-8 text-center">
            No {filter !== "all" ? filter : ""} transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
                  {["Type", "Ticker", "Qty", "Price", "Total", "Date"].map((header) => (
                    <th key={header} className="px-4 py-2 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction) => (
                  <tr key={transaction._id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={transaction.type === "buy" ? "badge-up" : "badge-down"}>
                        {transaction.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{transaction.ticker}</td>
                    <td className="px-4 py-3">{transaction.quantity}</td>
                    <td className="px-4 py-3 font-mono">{currency(transaction.price)}</td>
                    <td className="px-4 py-3 font-mono font-medium">
                      <span className={transaction.type === "buy" ? "text-red-300" : "text-green-300"}>
                        {transaction.type === "buy" ? "-" : "+"}{currency(transaction.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(transaction.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
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
