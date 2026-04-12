import React from "react";
import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/",             label: "Dashboard",    icon: "▦" },
  { to: "/trade",        label: "Trade",        icon: "⇅" },
  { to: "/portfolio",    label: "Portfolio",    icon: "◈" },
  { to: "/insights",     label: "AI Insights",  icon: "✦" },
  { to: "/transactions", label: "Transactions", icon: "≡" },
];

export default function Sidebar() {
  return (
    <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="px-4 pt-5 pb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Navigation</p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-green-600/20 text-green-400 font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
