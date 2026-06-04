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
  const [reviewing, setReviewing] = useState(false);

  const stock = stocks.find((item) => item.ticker === ticker);
  const price = priceMap[ticker] ?? stock?.price ?? 0;
  const total = useMemo(() => +(price * qty).toFixed(2), [price, qty]);
  const estimatedCash = mode === "buy"
    ? Number(user?.cashBalance ?? 0) - total
    : Number(user?.cashBalance ?? 0) + total;
  const sellCapacity = holding?.quantity || 0;
  const validation =
    mode === "buy" && estimatedCash < 0
      ? "Insufficient virtual cash for this order."
      : mode === "sell" && qty > sellCapacity
        ? "Quantity exceeds shares currently held."
        : "";

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
    setReviewing(false);
    if (!ticker) return;
    api.get("/portfolio").then(({ data }) => {
      const nextHolding = data.holdings.find((item) => item.ticker === ticker);
      setHolding(nextHolding || null);
    }).catch(() => setHolding(null));
  }, [ticker, mode, qty]);

  const execute = async () => {
    if (qty <= 0 || !price || validation) return;
    if (!reviewing) {
      setReviewing(true);
      setStatus(null);
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const { data } = await api.post(`/trade/${mode}`, { ticker, quantity: Number(qty) });
      updateBalance(data.cashBalance);
      setStatus({
        ok: true,
        msg: `${mode === "buy" ? "Bought" : "Sold"} ${qty} ${ticker} at ${currency(price)}`,
      });
      setReviewing(false);

      const { data: portfolio } = await api.get("/portfolio");
      setHolding(portfolio.holdings.find((item) => item.ticker === ticker) || null);
    } catch (err) {
      setStatus({ ok: false, msg: apiErrorMessage(err, "Trade failed") });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && Boolean(stock) && qty > 0 && price > 0 && !validation;
  const actionLabel = reviewing
    ? `Confirm ${mode === "buy" ? "buy" : "sell"} order`
    : `Review ${mode === "buy" ? "buy" : "sell"} order`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Order management</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Trade Desk</h1>
          <p className="mt-1 text-sm text-slate-500">
            Place intentional simulated orders with a clear virtual-cash breakdown.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="panel p-4">
          <h2 className="section-title">Instrument</h2>
          <div className="mt-4">
            <label className="stat-label mb-1.5 block">Select stock</label>
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
            <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ticker-chip">{stock.ticker}</p>
                  <p className="mt-3 mono text-3xl font-semibold text-slate-50">{currency(price)}</p>
                  <p className="mt-1 text-sm text-slate-500">{stock.name}</p>
                </div>
                <span className={stock.change >= 0 ? "badge-up" : "badge-down"}>
                  {signedPercent(stock.change)}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4">
                <div>
                  <p className="stat-label">Sector</p>
                  <p className="mt-1 text-sm text-slate-300">{stock.sector}</p>
                </div>
                <div>
                  <p className="stat-label">Held</p>
                  <p className="mono mt-1 text-sm text-slate-300">{sellCapacity} shares</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 empty-state min-h-32">Connecting to market stream...</div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="section-title">Order Ticket</h2>
            <p className="section-subtitle mt-1">All orders use virtual funds only.</p>
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-800 bg-slate-950/60">
                <button
                  onClick={() => { setMode("buy"); setReviewing(false); }}
                  className={`py-2.5 text-sm font-semibold transition-colors ${
                    mode === "buy" ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => { setMode("sell"); setReviewing(false); }}
                  className={`py-2.5 text-sm font-semibold transition-colors ${
                    mode === "sell" ? "bg-red-500 text-white" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  Sell
                </button>
              </div>

              <div>
                <label className="stat-label mb-1.5 block">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={qty}
                  onChange={(event) => {
                    setQty(Math.max(1, parseInt(event.target.value, 10) || 1));
                    setReviewing(false);
                  }}
                  className="input mono"
                />
              </div>

              {validation && <div className="alert-error">{validation}</div>}

              {reviewing && !validation && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Review this simulated {mode} order before confirming. No real money is used.
                </div>
              )}

              {status && (
                <div className={status.ok ? "alert-success flex items-start gap-2" : "alert-error flex items-start gap-2"}>
                  {status.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                  <span>{status.msg}</span>
                </div>
              )}

              <button
                onClick={execute}
                disabled={!canSubmit}
                className={`w-full ${mode === "buy" ? "btn-buy" : "btn-sell"}`}
              >
                {loading ? "Processing..." : actionLabel}
              </button>
            </div>

            <aside className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="section-title">Order Breakdown</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Last price</span>
                  <span className="mono text-slate-100">{currency(price)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Quantity</span>
                  <span className="mono text-slate-100">{qty}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-800 pt-3">
                  <span className="font-medium text-slate-300">Estimated value</span>
                  <span className="mono font-semibold text-slate-50">{currency(total)}</span>
                </div>
                <div className="flex justify-between gap-4 pt-2">
                  <span className="text-slate-500">Cash before</span>
                  <span className="mono text-slate-300">{currency(user?.cashBalance)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Cash after</span>
                  <span className={`mono ${estimatedCash >= 0 ? "text-slate-300" : "text-red-300"}`}>
                    {currency(estimatedCash)}
                  </span>
                </div>
              </div>

              {holding && (
                <div className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
                  Current position:{" "}
                  <span className="mono text-slate-300">{holding.quantity}</span> shares at avg cost{" "}
                  <span className="mono text-slate-300">{currency(holding.avgCost)}</span>.
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
