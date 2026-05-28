import React from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, BrainCircuit, CandlestickChart, ListOrdered, PieChart } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", Icon: BarChart3 },
  { to: "/trade", label: "Trade", Icon: CandlestickChart },
  { to: "/portfolio", label: "Portfolio", Icon: PieChart },
  { to: "/insights", label: "AI Insights", Icon: BrainCircuit },
  { to: "/transactions", label: "Transactions", Icon: ListOrdered },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
    isActive
      ? "bg-green-600/20 text-green-300 font-medium"
      : "text-gray-400 hover:text-white hover:bg-gray-800"
  }`;

export default function Sidebar() {
  return (
    <>
      <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
        <div className="px-4 pt-5 pb-6">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Navigation</p>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} className={linkClass}>
                <Icon size={17} strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="grid grid-cols-5 px-1 py-2">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] ${
                  isActive ? "text-green-300" : "text-gray-500"
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="truncate max-w-full">{label.replace("AI ", "")}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
