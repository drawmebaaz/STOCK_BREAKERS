import React from "react";
import { LogOut } from "lucide-react";
import { useAuthStore, usePriceStore } from "../../stores/index.js";
import { currency } from "../../utils/format.js";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const connected = usePriceStore((s) => s.connected);
  const lastUpdated = usePriceStore((s) => s.lastUpdated);

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--";

  return (
    <header className="h-16 shrink-0 border-b border-slate-800/80 bg-[#0b0f16]/90 px-4 backdrop-blur md:px-6">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-600"}`}
              title={connected ? "Market stream connected" : "Market stream connecting"}
            />
            <p className="truncate text-sm font-medium text-slate-200">
              {connected ? "Live market stream" : "Connecting market stream"}
            </p>
          </div>
          <p className="mt-0.5 hidden text-xs text-slate-600 sm:block">Last tick {updatedLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-right sm:block">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Virtual cash</p>
            <p className="mono text-sm font-semibold text-slate-100">{currency(user?.cashBalance)}</p>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-xs font-semibold text-slate-200">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-32 truncate text-xs font-medium text-slate-200">{user?.name || "Trader"}</p>
              <p className="text-[11px] text-slate-600">Learner account</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 bg-slate-950/60 text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-100"
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
