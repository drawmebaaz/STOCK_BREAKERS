import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePriceStore, useAuthStore } from "../stores/index.js";
import { api } from "../utils/api.js";

export default function TradePage() {
  const { ticker: paramTicker } = useParams();
  const navigate = useNavigate();
  const stocks = usePriceStore((s) => s.stocks);
  const priceMap = usePriceStore((s) => s.priceMap);
  const { user, updateBalance } = useAuthStore();

  const [ticker, setTicker] = useState(paramTicker || "AAPL");
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState("buy"); // "buy" | "sell"
  const [status, setStatus] = useState(null); // { ok, msg }
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(null);

  const stock = stocks.find((s) => s.ticker === ticker);
  const price = priceMap[ticker] ?? 0;
  const total = (price * qty).toFixed(2);

  // Fetch user's holding for this ticker
  useEffect(() => {
    if (!ticker) return;
    api.get("/portfolio").then(({ data }) => {
      const h = data.holdings.find((h) => h.ticker === ticker);
      setHolding(h || null);
    });
  }, [ticker]);

  const execute = async () => {
    if (qty <= 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const { data } = await api.post(`/trade/${mode}`, { ticker, quantity: Number(qty) });
      updateBalance(data.cashBalance);
      setStatus({ ok: true, msg: `${mode === "buy" ? "Bought" : "Sold"} ${qty} × ${ticker} @ $${price.toFixed(2)}` });
      // refresh holding
      const { data: p } = await api.get("/portfolio");
      setHolding(p.holdings.find((h) => h.ticker === ticker) || null);
    } catch (err) {
      setStatus({ ok: false, msg: err.response?.data?.error || "Trade failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Trade</h1>

      {/* Stock selector */}
      <div className="card space-y-4">
        <div>
          <label className="stat-label mb-1 block">Select stock</label>
          <select
            className="input"
            value={ticker}
            onChange={(e) => { setTicker(e.target.value); setStatus(null); navigate(`/trade/${e.target.value}`); }}
          >
            {stocks.map((s) => (
              <option key={s.ticker} value={s.ticker}>{s.ticker} — {s.name}</option>
            ))}
          </select>
        </div>

        {stock && (
          <div className="flex justify-between items-center bg-gray-800 rounded-lg px-4 py-3">
            <div>
              <p className="text-2xl font-bold font-mono">${price.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{stock.name}</p>
            </div>
            <span className={stock.change >= 0 ? "badge-up text-sm" : "badge-down text-sm"}>
              {stock.change >= 0 ? "+" : ""}{stock.change?.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Order panel */}
      <div className="card space-y-4">
        {/* Buy / Sell toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setMode("buy")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "buy" ? "bg-green-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
          >Buy</button>
          <button
            onClick={() => setMode("sell")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "sell" ? "bg-red-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
          >Sell</button>
        </div>

        {/* Quantity */}
        <div>
          <label className="stat-label mb-1 block">Quantity</label>
          <input
            type="number" min="1" value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="input"
          />
        </div>

        {/* Order summary */}
        <div className="bg-gray-800 rounded-lg px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Price</span><span>${price.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span>{qty}</span></div>
          <div className="flex justify-between font-semibold border-t border-gray-700 pt-1.5 mt-1.5">
            <span>Total</span><span>${total}</span>
          </div>
          {mode === "buy" && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Cash available</span>
              <span>${user?.cashBalance?.toFixed(2)}</span>
            </div>
          )}
          {mode === "sell" && holding && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Shares held</span><span>{holding.quantity}</span>
            </div>
          )}
        </div>

        {/* Holding info */}
        {holding && (
          <div className="text-xs text-gray-500 bg-gray-800/50 rounded px-3 py-2">
            Current position: {holding.quantity} shares · avg cost ${holding.avgCost.toFixed(2)} ·{" "}
            <span className={holding.pnl >= 0 ? "text-green-400" : "text-red-400"}>
              {holding.pnl >= 0 ? "+" : ""}${holding.pnl?.toFixed(2)} ({holding.pnlPct?.toFixed(1)}%)
            </span>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className={`text-sm px-3 py-2 rounded-lg ${status.ok ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
            {status.msg}
          </div>
        )}

        <button
          onClick={execute}
          disabled={loading}
          className={`w-full py-2.5 font-semibold rounded-lg transition-colors ${mode === "buy" ? "btn-primary" : "btn-danger"}`}
        >
          {loading ? "Processing…" : `${mode === "buy" ? "Buy" : "Sell"} ${qty} share${qty !== 1 ? "s" : ""} of ${ticker}`}
        </button>
      </div>
    </div>
  );
}
