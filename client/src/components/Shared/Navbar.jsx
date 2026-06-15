import React from "react";
import { LogOut, Radio } from "lucide-react";
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
    <header className="h-16 shrink-0 border-b border-slate-800/80 bg-[#060b14]/92 px-4 backdrop-blur md:px-6">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b713e]">StockBreakers</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">Paper Trading Lab</h1>
              <span className="badge-accent hidden lg:inline-flex">Virtual funds only</span>
            </div>
          </div>

          <div className="h-9 w-px bg-slate-800 hidden lg:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-[#53d6d0]" : "bg-slate-600"}`}
                title={connected ? "Market stream connected" : "Market stream connecting"}
              />
              <Radio size={14} className={connected ? "text-[#53d6d0]" : "text-slate-600"} />
              <p className="truncate text-sm font-medium text-slate-200">
                {connected ? "Live stream active" : "Connecting market stream"}
              </p>
            </div>
            <p className="mt-0.5 hidden text-xs text-slate-600 sm:block">Last tick: {updatedLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden rounded-md border border-slate-800 bg-[#080f1a]/80 px-3 py-2 text-right sm:block">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">Virtual cash</p>
            <p className="mono text-sm font-semibold text-slate-100">{currency(user?.cashBalance)}</p>
          </div>

          <div className="hidden rounded-md border border-slate-800 bg-[#080f1a]/80 px-3 py-2 text-right lg:block">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">Total equity</p>
            <p className="mono text-sm font-semibold text-[#c6a15b]">{summary ? currency(summary.totalValue) : "--"}</p>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-[#080f1a]/80 px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-[#8b713e]/50 bg-[#c6a15b]/10 text-xs font-semibold text-[#c6a15b]">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-32 truncate text-xs font-medium text-slate-200">{user?.name || "Trader"}</p>
              <p className="text-[11px] text-slate-600">Learner account</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 bg-[#080f1a]/80 text-slate-500 transition-colors hover:border-[#8b713e]/70 hover:text-[#c6a15b]"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
