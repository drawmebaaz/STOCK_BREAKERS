import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { X } from "lucide-react";

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
      ? "border-[#8f7242]/70 bg-[#d0a24c]/10 text-slate-50"
      : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-[#111923] hover:text-slate-100"
  }`;

export default function Sidebar({ open = false, onClose = () => {} }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  return (
    <>
      <aside className="hidden w-[220px] shrink-0 border-r border-slate-800 bg-[#080d11] xl:flex xl:flex-col">
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-[#101820] text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
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
