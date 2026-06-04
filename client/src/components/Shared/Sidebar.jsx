import React from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, CandlestickChart, LineChart, ListOrdered, PieChart } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", Icon: BarChart3 },
  { to: "/trade", label: "Trade Desk", Icon: CandlestickChart },
  { to: "/portfolio", label: "Portfolio", Icon: PieChart },
  { to: "/insights", label: "Research Lab", Icon: LineChart },
  { to: "/transactions", label: "Ledger", Icon: ListOrdered },
];

const desktopLinkClass = ({ isActive }) =>
  `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
    isActive
      ? "bg-slate-800/80 text-slate-50"
      : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
  }`;

export default function Sidebar() {
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-slate-800/80 bg-[#090d13]/95 md:flex md:flex-col">
        <div className="border-b border-slate-800/80 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Simulator</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-100">StockBreakers</h1>
          <p className="mt-1 text-xs text-slate-500">Paper trading lab</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={desktopLinkClass}>
              <Icon size={17} strokeWidth={1.8} className="text-slate-500 group-hover:text-slate-300" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800/80 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-600">Mode</p>
          <p className="mt-1 text-xs text-slate-400">Virtual funds only</p>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-[#090d13]/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors ${
                  isActive ? "bg-slate-800 text-slate-100" : "text-slate-500"
                }`
              }
            >
              <Icon size={17} strokeWidth={1.8} />
              <span className="max-w-full truncate">{label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
