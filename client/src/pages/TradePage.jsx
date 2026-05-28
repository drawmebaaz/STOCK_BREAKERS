import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuthStore, usePriceStore } from "../stores/index.js";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency, signedPercent } from "../utils/format.js";

export default function TradePage() {
  const { ticker: paramTicker } = useParams();
  const navigate = useNavigate();
  const stocks = usePriceStore((s) => s.stocks);
  const priceMap = usePriceStore((s) => s.priceMap);
  const { user, updateBalance } = useAuthStore();

  const [ticker, setTicker] = useState(paramTicker || "AAPL");
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState("buy");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(null);

  const stock = stocks.find((item) => item.ticker === ticker);
  const price = priceMap[ticker] ?? stock?.price ?? 0;
  const total = useMemo(() => +(price * qty).toFixed(2), [price, qty]);

  useEffect(() => {
    if (paramTicker) setTicker(paramTicker.toUpperCase());
  }, [paramTicker]);

  useEffect(() => {
    if (stocks.length > 0 && !stocks.some((item) => item.ticker === ticker)) {
      const fallback = stocks[0].ticker;
      setTicker(fallback);
      navigate(`/trade/${fallback}`, { replace: true });
    }
  }, [navigate, stocks, ticker]);

  useEffect(() => {
    if (!ticker) return;
    api.get("/portfolio").then(({ data }) => {
      const nextHolding = data.holdings.find((item) => item.ticker === ticker);
      setHolding(nextHolding || null);
    }).catch(() => setHolding(null));
  }, [ticker]);

  const execute = async () => {
    if (qty <= 0 || !price) return;
    setLoading(true);
    setStatus(null);
    try {
      const { data } = await api.post(`/trade/${mode}`, { ticker, quantity: Number(qty) });
      updateBalance(data.cashBalance);
      setStatus({
        ok: true,
        msg: `${mode === "buy" ? "Bought" : "Sold"} ${qty} ${ticker} at ${currency(price)}`,
      });

      const { data: portfolio } = await api.get("/portfolio");
      setHolding(portfolio.holdings.find((item) => item.ticker === ticker) || null);
    } catch (err) {
      setStatus({ ok: false, msg: apiErrorMessage(err, "Trade failed") });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && Boolean(stock) && qty > 0 && price > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Trade</h1>
        <p className="text-xs text-gray-500 mt-1">Place simulated buy and sell orders against the live paper market</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="card space-y-4">
          <div>
            <label className="stat-label mb-1 block">Select stock</label>
            <select
              className="input"
              value={ticker}
              onChange={(event) => {
                setTicker(event.target.value);
                setStatus(null);
                navigate(`/trade/${event.target.value}`);
              }}
            >
              {stocks.map((item) => (
                <option key={item.ticker} value={item.ticker}>{item.ticker} - {item.name}</option>
              ))}
            </select>
          </div>

          {stock ? (
            <div className="rounded-lg bg-gray-800 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold font-mono">{currency(price)}</p>
                  <p className="text-xs text-gray-500">{stock.name}</p>
                </div>
                <span className={stock.change >= 0 ? "badge-up text-sm" : "badge-down text-sm"}>
                  {signedPercent(stock.change)}
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500">{stock.sector}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-800 px-4 py-6 text-center text-sm text-gray-500">
              Connecting to market stream...
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-700">
            <button
              onClick={() => setMode("buy")}
              className={`py-2 text-sm font-medium transition-colors ${mode === "buy" ? "bg-green-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
            >
              Buy
            </button>
            <button
              onClick={() => setMode("sell")}
              className={`py-2 text-sm font-medium transition-colors ${mode === "sell" ? "bg-red-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
            >
              Sell
            </button>
          </div>

          <div>
            <label className="stat-label mb-1 block">Quantity</label>
            <input
              type="number"
              min="1"
              max="10000"
              value={qty}
              onChange={(event) => setQty(Math.max(1, parseInt(event.target.value, 10) || 1))}
              className="input"
            />
          </div>

          <div className="rounded-lg bg-gray-800 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Price</span><span>{currency(price)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span>{qty}</span></div>
            <div className="flex justify-between font-semibold border-t border-gray-700 pt-1.5 mt-1.5">
              <span>Total</span><span>{currency(total)}</span>
            </div>
            {mode === "buy" && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Cash available</span>
                <span>{currency(user?.cashBalance)}</span>
              </div>
            )}
            {mode === "sell" && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Shares held</span><span>{holding?.quantity || 0}</span>
              </div>
            )}
          </div>

          {holding && (
            <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-xs text-gray-500">
              Current position: {holding.quantity} shares, avg cost {currency(holding.avgCost)},{" "}
              <span className={holding.pnl >= 0 ? "text-green-300" : "text-red-300"}>
                {holding.pnl >= 0 ? "+" : ""}{currency(holding.pnl)} ({signedPercent(holding.pnlPct, 1)})
              </span>
            </div>
          )}

          {status && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              status.ok ? "bg-green-950/50 text-green-300" : "bg-red-950/50 text-red-300"
            }`}>
              {status.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
              <span>{status.msg}</span>
            </div>
          )}

          <button
            onClick={execute}
            disabled={!canSubmit}
            className={`w-full py-2.5 font-semibold rounded-lg transition-colors ${mode === "buy" ? "btn-primary" : "btn-danger"}`}
          >
            {loading ? "Processing..." : `${mode === "buy" ? "Buy" : "Sell"} ${qty} share${qty !== 1 ? "s" : ""} of ${ticker}`}
          </button>
        </div>
      </div>
    </div>
  );
}
