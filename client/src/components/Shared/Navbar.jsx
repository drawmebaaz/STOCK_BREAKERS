import React from "react";
import { useAuthStore, usePortfolioStore, usePriceStore } from "../../stores/index.js";
import { currency } from "../../utils/format.js";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const summary = usePortfolioStore((s) => s.summary);
  const connected = usePriceStore((s) => s.connected);
  const lastUpdated = usePriceStore((s) => s.lastUpdated);

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--";

  return (
    <header className="h-16 shrink-0 border-b border-slate-800 bg-[#0a1017] px-4 md:px-6">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold text-slate-100">StockBreakers</p>
            <p className="text-xs text-slate-500">Paper trading simulator</p>
          </div>

          <div className="hidden h-8 w-px bg-slate-800 lg:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-600"}`}
                title={connected ? "Market stream connected" : "Market stream connecting"}
              />
              <p className="truncate text-sm font-medium text-slate-200">
                {connected ? "Practice prices updating" : "Connecting prices"}
              </p>
            </div>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Updated: {updatedLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden rounded-md border border-slate-800 bg-[#101821] px-3 py-2 text-right sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Virtual cash</p>
            <p className="mono text-sm font-semibold text-slate-100">{currency(user?.cashBalance)}</p>
          </div>

          <div className="hidden rounded-md border border-slate-800 bg-[#101821] px-3 py-2 text-right xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Total equity</p>
            <p className="mono text-sm font-semibold text-[#d3aa5e]">{summary ? currency(summary.totalValue) : "--"}</p>
          </div>

          <div className="hidden rounded-md border border-slate-800 bg-[#101821] px-3 py-2 sm:block">
            <div className="min-w-0">
              <p className="max-w-32 truncate text-xs font-medium text-slate-200">{user?.name || "Trader"}</p>
              <p className="text-[11px] text-slate-500">Practice account</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-800 bg-[#101821] px-3 text-xs font-semibold text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
            title="Sign out"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
