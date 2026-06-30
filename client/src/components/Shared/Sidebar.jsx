import React, { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuthStore, usePriceStore } from "../../stores/index.js";
import { signedPercent } from "../../utils/format.js";

const NAV = [
  { to: "/", label: "Overview", description: "Market watch" },
  { to: "/trade", label: "Trade Desk", description: "Order ticket" },
  { to: "/orders", label: "Orders", description: "Open and recent" },
  { to: "/portfolio", label: "Portfolio", description: "Holdings" },
  { to: "/insights", label: "Scenarios", description: "Risk ranges" },
  { to: "/discipline", label: "Discipline", description: "Review habits" },
  { to: "/transactions", label: "History", description: "Past orders" },
];

const desktopLinkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
    isActive
      ? "border-[#8f713e]/70 bg-[#bc9042]/10 text-slate-50"
      : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-[#111923] hover:text-slate-100"
  }`;

export default function Sidebar({ open = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const stocks = usePriceStore((s) => s.stocks);
  const watched = stocks.filter((stock) => (user?.watchlist || []).includes(stock.ticker)).slice(0, 4);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const goTo = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <aside className="hidden w-[220px] shrink-0 border-r border-slate-800 bg-[#0a1017] xl:flex xl:flex-col">
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-100">StockBreakers</p>
            <p className="mt-1 text-xs text-slate-500">Paper trading simulator</p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {NAV.map(({ to, label, description }) => (
            <NavLink key={to} to={to} end={to === "/"} className={desktopLinkClass}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="mx-3 mt-2 border-t border-slate-800 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400">Watchlist</div>
            <span className="badge-neutral">{watched.length}</span>
          </div>

          <div className="space-y-2">
            {watched.length === 0 ? (
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-md border border-dashed border-slate-700 px-3 py-3 text-left text-xs leading-5 text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300"
              >
                Add stocks from Market Watch to keep them here.
              </button>
            ) : (
              watched.map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => navigate(`/trade/${stock.ticker}`)}
                  className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-[#0d141d] px-3 py-2 text-left transition-colors hover:border-slate-700 hover:bg-[#121b26]"
                  title={`${stock.ticker} ${signedPercent(stock.change)}`}
                >
                  <span>
                    <span className="block font-mono text-xs font-semibold text-slate-200">{stock.ticker}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{stock.sector}</span>
                  </span>
                  <span className={stock.change >= 0 ? "text-xs font-semibold text-emerald-300" : "text-xs font-semibold text-red-300"}>
                    {signedPercent(stock.change, 1)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto border-t border-slate-800 px-4 py-4">
          <p className="text-xs font-medium text-slate-300">Educational mode</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Virtual funds only. No real orders are placed.</p>
        </div>
      </aside>

      {open && (
        <div className="mobile-sidebar-shell xl:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="mobile-sidebar-backdrop"
            aria-label="Close navigation"
            onClick={onClose}
          />

          <aside className="mobile-sidebar-panel">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-100">StockBreakers</p>
                <p className="mt-1 text-xs text-slate-500">Paper trading simulator</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-[#101821] text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                aria-label="Close navigation"
                title="Close navigation"
              >
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <nav className="space-y-1 px-3 py-4" aria-label="Primary navigation">
              {NAV.map(({ to, label, description }) => (
                <NavLink key={to} to={to} end={to === "/"} onClick={onClose} className={desktopLinkClass}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{label}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
                  </span>
                </NavLink>
              ))}
            </nav>

            <div className="mx-3 border-t border-slate-800 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-400">Watchlist</div>
                <span className="badge-neutral">{watched.length}</span>
              </div>

              <div className="space-y-2">
                {watched.length === 0 ? (
                  <button
                    onClick={() => goTo("/")}
                    className="w-full rounded-md border border-dashed border-slate-700 px-3 py-3 text-left text-xs leading-5 text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300"
                  >
                    Add stocks from Market Watch to keep them here.
                  </button>
                ) : (
                  watched.map((stock) => (
                    <button
                      key={stock.ticker}
                      onClick={() => goTo(`/trade/${stock.ticker}`)}
                      className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-[#0d141d] px-3 py-2 text-left transition-colors hover:border-slate-700 hover:bg-[#121b26]"
                      title={`${stock.ticker} ${signedPercent(stock.change)}`}
                    >
                      <span>
                        <span className="block font-mono text-xs font-semibold text-slate-200">{stock.ticker}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{stock.sector}</span>
                      </span>
                      <span className={stock.change >= 0 ? "text-xs font-semibold text-emerald-300" : "text-xs font-semibold text-red-300"}>
                        {signedPercent(stock.change, 1)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-auto border-t border-slate-800 px-4 py-4">
              <p className="text-xs font-medium text-slate-300">Educational mode</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Virtual funds only. No real orders are placed.</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
