import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePortfolio } from "../hooks/index.js";
import { useAuthStore, usePortfolioStore, usePriceStore } from "../stores/index.js";
import { api, apiErrorMessage } from "../utils/api.js";
import { currency, signedPercent } from "../utils/format.js";

const SETUP_TYPES = [
  ["BREAKOUT", "Breakout"],
  ["PULLBACK", "Pullback"],
  ["MOMENTUM", "Momentum"],
  ["REVERSAL", "Reversal"],
  ["RANGE", "Range"],
  ["PRACTICE", "Practice"],
  ["OTHER", "Other"],
];

const HOLDING_PERIODS = [
  ["INTRADAY", "Same day"],
  ["SWING", "Few days"],
  ["POSITION", "Longer hold"],
  ["PRACTICE", "Practice"],
];

const makeKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function SummaryRow({ label, value, tone = "neutral" }) {
  const toneClass = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-slate-200",
  }[tone];
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`mono text-right font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}

function StatusCard({ order, onCancel, cancelling }) {
  if (!order) return null;
  const cfg = {
    FILLED: "badge-up",
    PARTIALLY_FILLED: "badge-accent",
    PENDING: "badge-neutral",
    CANCELLED: "badge-neutral",
    REJECTED: "badge-down",
    EXPIRED: "badge-down",
  };
  const canCancel = ["PENDING", "PARTIALLY_FILLED"].includes(order.status);
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">Order Result</h3>
          <p className="mt-1 text-sm text-slate-500">
            {order.side} {order.quantity} {order.ticker} - {order.type.toLowerCase()} order
          </p>
        </div>
        <span className={cfg[order.status] || "badge-neutral"}>{order.status.replace("_", " ")}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryRow label="Filled" value={`${order.filledQuantity || 0}/${order.quantity}`} />
        <SummaryRow label="Avg fill" value={order.avgFillPrice ? currency(order.avgFillPrice) : "--"} />
        <SummaryRow label="Slippage" value={currency(order.actualSlippage || 0)} />
        {Number(order.reservedCashAmount || 0) > 0 && <SummaryRow label="Cash reserved" value={currency(order.reservedCashAmount)} />}
        {Number(order.reservedShareQuantity || 0) > 0 && <SummaryRow label="Shares reserved" value={`${order.reservedShareQuantity}`} />}
      </div>
      {order.rejectionReason && <div className="alert-error mt-4">{order.rejectionReason}</div>}
      {canCancel && (
        <button onClick={onCancel} disabled={cancelling} className="btn-ghost mt-4 px-3 py-1.5 text-xs">
          {cancelling ? "Cancelling..." : "Cancel pending order"}
        </button>
      )}
    </div>
  );
}

export default function TradePage() {
  const { ticker: paramTicker } = useParams();
  const navigate = useNavigate();
  const { refresh } = usePortfolio();
  const { user, updateBalance } = useAuthStore();
  const { holdings, summary } = usePortfolioStore();
  const stocks = usePriceStore((s) => s.stocks);
  const marketStatus = usePriceStore((s) => s.marketStatus);

  const [ticker, setTicker] = useState(paramTicker || "AAPL");
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("MARKET");
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [riskSettings, setRiskSettings] = useState(null);
  const [plan, setPlan] = useState({
    thesis: "",
    setupType: "PRACTICE",
    entryReason: "",
    invalidationReason: "",
    stopLoss: "",
    targetPrice: "",
    confidence: 3,
    plannedHoldingPeriod: "PRACTICE",
  });
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [resultOrder, setResultOrder] = useState(null);
  const [events, setEvents] = useState([]);

  const stock = stocks.find((item) => item.ticker === ticker);
  const holding = holdings.find((item) => item.ticker === ticker);
  const qty = Math.max(1, Number(quantity || 1));
  const cash = Number(summary?.availableCash ?? user?.availableCash ?? user?.cashBalance ?? summary?.cash ?? 0);
  const totalEquity = Number(summary?.totalValue || cash);
  const bid = Number(stock?.bid || stock?.price || 0);
  const ask = Number(stock?.ask || stock?.price || 0);
  const mid = Number(stock?.mid || stock?.price || 0);
  const effectiveEntry = orderType === "LIMIT" && Number(limitPrice) > 0
    ? Number(limitPrice)
    : side === "BUY"
      ? ask
      : bid;
  const slippageEstimate = Math.max(0, effectiveEntry * (1 - Number(stock?.liquidityScore || 0.85)) * 0.001 + qty / Math.max(1000, Number(stock?.averageVolume || 500000)) * effectiveEntry);
  const fillEstimate = side === "BUY" ? effectiveEntry + slippageEstimate : Math.max(0.01, effectiveEntry - slippageEstimate);
  const tradeValue = fillEstimate * qty;
  const sharesHeld = Number(holding?.quantity || 0);
  const availableShares = Number(holding?.availableQuantity ?? Math.max(0, sharesHeld - Number(holding?.reservedQuantity || 0)));
  const positionAfter = side === "BUY" ? sharesHeld + qty : Math.max(0, sharesHeld - qty);
  const cashAfter = side === "BUY" ? cash - tradeValue : cash + tradeValue;
  const pendingReservation = orderType === "LIMIT" && side === "BUY" && Number(limitPrice) > 0
    ? Number(limitPrice) * qty + Math.abs(slippageEstimate) * qty
    : 0;
  const cashAfterReservation = side === "BUY" && orderType === "LIMIT" ? cash - pendingReservation : cashAfter;
  const stopLoss = Number(plan.stopLoss || 0);
  const targetPrice = Number(plan.targetPrice || 0);
  const riskPerShare = side === "BUY" && stopLoss > 0 ? Math.max(0, fillEstimate - stopLoss) : 0;
  const rewardPerShare = side === "BUY" && targetPrice > 0 ? Math.max(0, targetPrice - fillEstimate) : 0;
  const maxLoss = riskPerShare * qty;
  const possibleReward = rewardPerShare * qty;
  const riskPercent = totalEquity > 0 ? (maxLoss / totalEquity) * 100 : 0;
  const rewardRisk = maxLoss > 0 ? possibleReward / maxLoss : 0;
  const maxRiskPercent = Number(riskSettings?.maxRiskPerTradePercent || 2);
  const maxRiskAmount = totalEquity * (maxRiskPercent / 100);
  const maxQtyByRisk = riskPerShare > 0 ? Math.floor(maxRiskAmount / riskPerShare) : 0;
  const tickerExposure = totalEquity > 0 ? ((positionAfter * mid) / totalEquity) * 100 : 0;
  const session = marketStatus?.session || marketStatus?.status || stock?.marketSession || "OPEN";

  const warnings = [
    side === "BUY" && orderType === "LIMIT" && cashAfterReservation < 0 ? "This pending order needs more available virtual cash than you have." : null,
    side === "BUY" && orderType !== "LIMIT" && cashAfter < 0 ? "This order needs more available virtual cash than you have." : null,
    side === "SELL" && qty > availableShares ? "You do not have enough available shares to sell this quantity." : null,
    orderType === "LIMIT" && !Number(limitPrice) ? "Enter a limit price for this order." : null,
    orderType === "MARKET" && session === "CLOSED" ? "The simulated market is closed. Market orders will not fill right now." : null,
    session !== "OPEN" && session !== "CLOSED" ? "This session has lower liquidity, so spread and slippage may be wider." : null,
    events.length > 0 ? "A simulated event is active for this stock. Review size and stop-loss carefully." : null,
    side === "BUY" && stopLoss > 0 && stopLoss >= fillEstimate ? "Stop-loss should be below the expected entry price." : null,
    side === "BUY" && targetPrice > 0 && targetPrice <= fillEstimate ? "Target should be above the expected entry price." : null,
    side === "BUY" && riskPerShare > 0 && maxQtyByRisk > 0 && qty > maxQtyByRisk
      ? `This size risks more than your ${maxRiskPercent}% per-trade limit.`
      : null,
    tickerExposure > Number(riskSettings?.maxTickerExposurePercent || 25)
      ? "This would make the position large compared with your account size."
      : null,
  ].filter(Boolean);

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
    api.get("/risk/settings")
      .then(({ data }) => setRiskSettings(data.settings))
      .catch(() => setRiskSettings(null));
  }, []);

  useEffect(() => {
    setError("");
    setResultOrder(null);
  }, [ticker, side, orderType, quantity, limitPrice]);

  useEffect(() => {
    let cancelled = false;
    api.get(`/market/events?ticker=${ticker}`)
      .then(({ data }) => {
        if (!cancelled) setEvents(data.events || []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const updatePlan = (field, value) => {
    setPlan((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const place = async () => {
    if (!stock) return;
    if (warnings.some((warning) => warning.includes("more available virtual cash") || warning.includes("not have enough available shares") || warning.includes("limit price"))) {
      setError(warnings[0]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        ticker,
        side,
        type: orderType,
        quantity: qty,
        limitPrice: orderType === "LIMIT" ? Number(limitPrice) : undefined,
        idempotencyKey: makeKey(),
        tradePlan: {
          ...plan,
          stopLoss: plan.stopLoss ? Number(plan.stopLoss) : undefined,
          targetPrice: plan.targetPrice ? Number(plan.targetPrice) : undefined,
          confidence: Number(plan.confidence),
        },
      };
      const { data } = await api.post("/orders", payload);
      setResultOrder(data.order);
      if (data.snapshot?.cash !== undefined) updateBalance(data.snapshot.cash);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Order could not be placed"));
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (!resultOrder?._id) return;
    setCancelling(true);
    setError("");
    try {
      const { data } = await api.post(`/orders/${resultOrder._id}/cancel`);
      setResultOrder(data.order);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not cancel order"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label">Order ticket</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Trade Desk</h1>
          <p className="mt-1 text-sm text-slate-500">
            Place simulated market or limit orders, with risk checked before submission.
          </p>
        </div>
        <button onClick={() => navigate("/orders")} className="btn-ghost">View Orders</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="panel p-4">
          <h2 className="section-title">Market Quote</h2>
          <label className="mt-4 block">
            <span className="stat-label mb-1 block">Stock</span>
            <select
              className="input"
              value={ticker}
              onChange={(event) => {
                setTicker(event.target.value);
                navigate(`/trade/${event.target.value}`);
              }}
            >
              {stocks.map((item) => (
                <option key={item.ticker} value={item.ticker}>{item.ticker} - {item.name}</option>
              ))}
            </select>
          </label>

          {stock ? (
            <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ticker-chip">{stock.ticker}</p>
                  <p className="mono mt-3 text-3xl font-semibold text-slate-50">{currency(stock.price)}</p>
                  <p className="mt-1 text-sm text-slate-500">{stock.name}</p>
                </div>
                <span className={stock.change >= 0 ? "badge-up" : "badge-down"}>{signedPercent(stock.change)}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4">
                <SummaryRow label="Bid" value={currency(bid)} />
                <SummaryRow label="Ask" value={currency(ask)} />
                <SummaryRow label="Spread" value={currency(stock.spread || ask - bid)} />
                <SummaryRow label="Available" value={`${availableShares} shares`} />
                <SummaryRow label="Session" value={session.replace("_", " ")} tone={session === "OPEN" ? "positive" : "warning"} />
                <SummaryRow label="Volume" value={Number(stock.volume || 0).toLocaleString("en-IN")} />
                <SummaryRow label="Day low" value={currency(stock.dayLow)} />
                <SummaryRow label="Day high" value={currency(stock.dayHigh)} />
              </div>
              {events.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {events[0].headline}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state mt-4 min-h-40">Connecting to prices...</div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="section-title">Order Details</h2>
            <p className="section-subtitle mt-1">All orders are simulated and use virtual funds only.</p>
          </div>

          <div className="grid gap-6 p-4 2xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-800 bg-slate-950/60">
                {["BUY", "SELL"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setSide(item)}
                    className={`py-2.5 text-sm font-semibold transition-colors ${
                      side === item
                        ? item === "BUY"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-red-500 text-white"
                        : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    {item === "BUY" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label>
                  <span className="stat-label mb-1 block">Order type</span>
                  <select className="input" value={orderType} onChange={(event) => setOrderType(event.target.value)}>
                    <option value="MARKET">Market</option>
                    <option value="LIMIT">Limit</option>
                  </select>
                </label>
                <label>
                  <span className="stat-label mb-1 block">Quantity</span>
                  <input
                    className="input mono"
                    type="number"
                    min="1"
                    max="100000"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <label>
                  <span className="stat-label mb-1 block">Limit price</span>
                  <input
                    className="input mono"
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={orderType !== "LIMIT"}
                    value={limitPrice}
                    onChange={(event) => setLimitPrice(event.target.value)}
                    placeholder={orderType === "LIMIT" ? "Price" : "Market order"}
                  />
                </label>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="section-title">Risk Plan</h2>
                  <span className="badge-neutral">Used for review later</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className="stat-label mb-1 block">Why this trade?</span>
                    <textarea
                      className="input min-h-20 resize-y"
                      value={plan.thesis}
                      onChange={(event) => updatePlan("thesis", event.target.value)}
                      placeholder="Example: price is holding above support after a pullback"
                    />
                  </label>
                  <label>
                    <span className="stat-label mb-1 block">Setup</span>
                    <select className="input" value={plan.setupType} onChange={(event) => updatePlan("setupType", event.target.value)}>
                      {SETUP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="stat-label mb-1 block">Holding time</span>
                    <select className="input" value={plan.plannedHoldingPeriod} onChange={(event) => updatePlan("plannedHoldingPeriod", event.target.value)}>
                      {HOLDING_PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="stat-label mb-1 block">Stop-loss</span>
                    <input className="input mono" type="number" min="0" step="0.01" value={plan.stopLoss} onChange={(event) => updatePlan("stopLoss", event.target.value)} />
                  </label>
                  <label>
                    <span className="stat-label mb-1 block">Target</span>
                    <input className="input mono" type="number" min="0" step="0.01" value={plan.targetPrice} onChange={(event) => updatePlan("targetPrice", event.target.value)} />
                  </label>
                  <label>
                    <span className="stat-label mb-1 block">Confidence</span>
                    <select className="input" value={plan.confidence} onChange={(event) => updatePlan("confidence", event.target.value)}>
                      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="stat-label mb-1 block">What would make you wrong?</span>
                    <input className="input" value={plan.invalidationReason} onChange={(event) => updatePlan("invalidationReason", event.target.value)} placeholder="Example: closes below support" />
                  </label>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="space-y-2">
                  {warnings.map((warning) => (
                    <div key={warning} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {warning}
                    </div>
                  ))}
                </div>
              )}
              {error && <div className="alert-error">{error}</div>}
              <StatusCard order={resultOrder} onCancel={cancel} cancelling={cancelling} />

              <button onClick={place} disabled={loading || !stock} className={side === "BUY" ? "btn-buy w-full" : "btn-sell w-full"}>
                {loading ? "Submitting..." : side === "BUY" ? "Place buy order" : "Place sell order"}
              </button>
            </div>

            <aside className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="section-title">Before You Submit</h3>
              <div className="mt-4 space-y-3">
                <SummaryRow label="Expected entry" value={currency(fillEstimate)} />
                <SummaryRow label="Estimated value" value={currency(tradeValue)} />
                <SummaryRow label="Available cash" value={currency(cash)} />
                {orderType === "LIMIT" && side === "BUY" && (
                  <SummaryRow label="Cash reserved if pending" value={currency(pendingReservation)} tone={cashAfterReservation < 0 ? "negative" : "neutral"} />
                )}
                {orderType === "LIMIT" && side === "SELL" && (
                  <SummaryRow label="Shares reserved if pending" value={`${qty}`} tone={qty > availableShares ? "negative" : "neutral"} />
                )}
                <SummaryRow label={orderType === "LIMIT" && side === "BUY" ? "Cash after reservation" : "Cash after"} value={currency(cashAfterReservation)} tone={cashAfterReservation < 0 ? "negative" : "neutral"} />
                <SummaryRow label="Shares after" value={`${positionAfter}`} />
                <SummaryRow label="Position size" value={`${tickerExposure.toFixed(1)}%`} tone={tickerExposure > 25 ? "warning" : "neutral"} />
                <div className="border-t border-slate-800 pt-3" />
                <SummaryRow label="Risk if stopped" value={riskPerShare > 0 ? currency(maxLoss) : "--"} tone={riskPercent > maxRiskPercent ? "warning" : "neutral"} />
                <SummaryRow label="Risk percent" value={riskPerShare > 0 ? `${riskPercent.toFixed(2)}%` : "--"} />
                <SummaryRow label="Reward/risk" value={rewardRisk > 0 ? `${rewardRisk.toFixed(2)}x` : "--"} />
                <SummaryRow label="Max size by risk" value={maxQtyByRisk > 0 ? `${maxQtyByRisk} shares` : "--"} />
              </div>
              <p className="mt-5 text-xs leading-5 text-slate-500">
                Market orders fill against ask for buys and bid for sells during allowed simulated sessions. Limit orders may stay pending until the simulated quote reaches your price.
              </p>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
