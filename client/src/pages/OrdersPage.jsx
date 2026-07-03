import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePriceStore } from "../stores/index.js";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency } from "../utils/format.js";

const STATUSES = ["ALL", "PENDING", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED", "EXPIRED"];

function statusClass(status) {
  return {
    FILLED: "badge-up",
    PARTIALLY_FILLED: "badge-accent",
    PENDING: "badge-neutral",
    CANCELLED: "badge-neutral",
    REJECTED: "badge-down",
    EXPIRED: "badge-down",
  }[status] || "badge-neutral";
}

function cleanReason(reason = "") {
  return String(reason).replace(/^[A-Z_]+:\s*/, "");
}

function orderNote(order, quote) {
  if (order.rejectionReason) return cleanReason(order.rejectionReason);
  if (order.status === "CANCELLED") return "Cancelled before it could finish filling.";
  if (order.status === "FILLED") return "Filled in the simulator.";
  if (!["PENDING", "PARTIALLY_FILLED"].includes(order.status)) return "";
  if (Number(order.reservedCashAmount || 0) > 0) return `${currency(order.reservedCashAmount)} is reserved until this order fills, cancels, or expires.`;
  if (Number(order.reservedShareQuantity || 0) > 0) return `${order.reservedShareQuantity} shares are reserved until this order fills, cancels, or expires.`;
  if (order.type === "LIMIT" && quote) {
    if (order.side === "BUY" && Number(quote.ask) > Number(order.limitPrice)) {
      return `Waiting for ask ${currency(quote.ask)} to reach your limit.`;
    }
    if (order.side === "SELL" && Number(quote.bid) < Number(order.limitPrice)) {
      return `Waiting for bid ${currency(quote.bid)} to reach your limit.`;
    }
  }
  if (order.type === "MARKET") return "Waiting for simulated market session and available liquidity.";
  return "Waiting for price or liquidity.";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  const priceMap = usePriceStore((s) => s.stocks.reduce((acc, stock) => {
    acc[stock.ticker] = stock;
    return acc;
  }, {}));

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = status === "ALL" ? "" : `?status=${status}`;
      const { data } = await api.get(`/orders${query}`);
      setOrders(data.orders || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load orders"));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const counts = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  const cancel = async (orderId) => {
    setCancellingId(orderId);
    setError("");
    try {
      const { data } = await api.post(`/orders/${orderId}/cancel`);
      setOrders((current) => current.map((order) => (order._id === orderId ? data.order : order)));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not cancel order"));
    } finally {
      setCancellingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Order book</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review placed orders, pending quantities, fills, and rejected attempts.
          </p>
        </div>
        <button onClick={loadOrders} disabled={loading} className="btn-ghost">
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="panel p-3">
        <div className="flex gap-2 overflow-x-auto">
          {STATUSES.map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                status === item ? "bg-[#d0a24c] text-[#071014]" : "border border-slate-800 text-slate-500 hover:text-slate-200"
              }`}
            >
              {item === "ALL" ? "All" : item.replace("_", " ")}
              {item !== "ALL" && counts[item] ? <span className="ml-2 mono">{counts[item]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="panel overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="section-title">Recent Orders</h2>
          <p className="section-subtitle mt-1">{orders.length} rows in this view.</p>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton h-10" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <p>No orders found for this view.</p>
          </div>
        ) : (
          <div className="max-h-[700px] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Stock</th>
                  <th>What is happening</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Filled</th>
                  <th className="text-right">Limit</th>
                  <th className="text-right">Avg Fill</th>
                  <th className="text-right">Spread Paid</th>
                  <th>Placed</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const canCancel = ["PENDING", "PARTIALLY_FILLED"].includes(order.status);
                  const note = orderNote(order, priceMap[order.ticker]);
                  return (
                    <tr key={order._id}>
                      <td><span className={statusClass(order.status)}>{order.status.replace("_", " ")}</span></td>
                      <td><span className="ticker-chip">{order.ticker}</span></td>
                      <td className="max-w-72 text-sm text-slate-500">{note || "--"}</td>
                      <td className={order.side === "BUY" ? "text-emerald-300" : "text-red-300"}>{order.side}</td>
                      <td className="text-slate-500">{order.type}</td>
                      <td className="mono text-right">{order.quantity}</td>
                      <td className="mono text-right">{order.filledQuantity || 0}/{order.quantity}</td>
                      <td className="mono text-right">{order.limitPrice ? currency(order.limitPrice) : "--"}</td>
                      <td className="mono text-right">{order.avgFillPrice ? currency(order.avgFillPrice) : "--"}</td>
                      <td className="mono text-right">{currency(order.spreadPaid || 0)}</td>
                      <td className="text-slate-500">
                        {new Date(order.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="text-right">
                        {canCancel ? (
                          <button
                            onClick={() => cancel(order._id)}
                            disabled={cancellingId === order._id}
                            className="btn-ghost px-3 py-1.5 text-xs"
                          >
                            {cancellingId === order._id ? "Cancelling" : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600">--</span>
                        )}
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
  );
}
