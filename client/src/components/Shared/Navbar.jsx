import React from "react";
import { Menu } from "lucide-react";
import { useAuthStore, usePortfolioStore, usePriceStore } from "../../stores/index.js";
import { currency, titleFromCode } from "../../utils/format.js";

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const summary = usePortfolioStore((s) => s.summary);
  const connected = usePriceStore((s) => s.connected);
  const degraded = usePriceStore((s) => s.degraded);
  const marketStatus = usePriceStore((s) => s.marketStatus);
  const lastUpdated = usePriceStore((s) => s.lastUpdated);

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--";
  const session = marketStatus?.session || marketStatus?.status || "OPEN";
  const sessionLabel = titleFromCode(session);

  return (
    <header className="mobile-topbar shrink-0 border-b border-slate-800 bg-[#080d11] px-3 sm:px-4 md:px-6">
      <div className="flex h-full items-center justify-between gap-3 md:gap-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-[#101820] text-slate-300 transition-colors hover:border-slate-600 hover:text-white xl:hidden"
            aria-label="Open navigation"
            title="Open navigation"
          >
            <Menu size={18} strokeWidth={1.9} />
          </button>

          <div className="min-w-0 xl:hidden">
            <p className="truncate text-sm font-semibold text-slate-100">StockBreakers</p>
            <p className="truncate text-xs text-slate-500 sm:hidden">
              {connected ? "Prices updating" : degraded ? "Using polling" : "Connecting"}
            </p>
            <p className="hidden text-xs text-slate-500 sm:block">Paper trading simulator</p>
          </div>

          <div className="hidden h-8 w-px bg-slate-800 xl:block" />

          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : degraded ? "bg-amber-400" : "bg-slate-600"}`}
                title={connected ? "Market stream connected" : degraded ? "Using polling fallback" : "Market stream connecting"}
              />
              <p className="truncate text-sm font-medium text-slate-200">
                {connected ? "Prices updating" : degraded ? "Using polling" : "Connecting"}
              </p>
            </div>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
              {sessionLabel} | Updated: {updatedLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden rounded-md border border-slate-800 bg-[#101820] px-3 py-2 text-right sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Market</p>
            <p className={session === "OPEN" ? "mono text-sm font-semibold text-emerald-300" : "mono text-sm font-semibold text-amber-300"}>
              {sessionLabel}
            </p>
          </div>

          <div className="hidden rounded-md border border-slate-800 bg-[#101820] px-3 py-2 text-right md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Virtual cash</p>
            <p className="mono text-sm font-semibold text-slate-100">{currency(user?.cashBalance)}</p>
          </div>

          <div className="hidden rounded-md border border-slate-800 bg-[#101820] px-3 py-2 text-right xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Total equity</p>
            <p className="mono text-sm font-semibold text-[#e0b865]">{summary ? currency(summary.totalValue) : "--"}</p>
          </div>

          <div className="hidden rounded-md border border-slate-800 bg-[#101820] px-3 py-2 lg:block">
            <div className="min-w-0">
              <p className="max-w-32 truncate text-xs font-medium text-slate-200">{user?.name || "Trader"}</p>
              <p className="text-[11px] text-slate-500">Practice account</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-800 bg-[#101820] px-2 text-[11px] font-semibold text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 sm:px-3 sm:text-xs"
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
