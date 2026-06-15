import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, CandlestickChart, LineChart, ListOrdered, PieChart, Star } from "lucide-react";
import { useAuthStore, usePriceStore } from "../../stores/index.js";
import { signedPercent } from "../../utils/format.js";

const NAV = [
  { to: "/", label: "Overview", Icon: BarChart3 },
  { to: "/trade", label: "Trade Desk", Icon: CandlestickChart },
  { to: "/portfolio", label: "Portfolio", Icon: PieChart },
  { to: "/insights", label: "Research Lab", Icon: LineChart },
  { to: "/transactions", label: "Ledger", Icon: ListOrdered },
];

const desktopLinkClass = ({ isActive }) =>
  `group relative flex h-11 w-11 items-center justify-center rounded-md border transition-colors ${
    isActive
      ? "border-[#8b713e]/70 bg-[#c6a15b]/12 text-[#c6a15b]"
      : "border-transparent text-slate-600 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-200"
  }`;

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const stocks = usePriceStore((s) => s.stocks);
  const watched = stocks.filter((stock) => (user?.watchlist || []).includes(stock.ticker)).slice(0, 5);

  return (
    <>
      <aside className="hidden w-[88px] shrink-0 border-r border-slate-800/80 bg-[#060b14]/95 md:flex md:flex-col md:items-center">
        <div className="flex h-16 w-full items-center justify-center border-b border-slate-800/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#8b713e]/60 bg-[#c6a15b]/10 font-mono text-sm font-bold text-[#c6a15b]">
            SB
          </div>
        </div>

        <nav className="flex flex-col gap-2 py-4">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={desktopLinkClass} title={label} aria-label={label}>
              <Icon size={18} strokeWidth={1.8} />
            </NavLink>
          ))}
        </nav>

        <div className="mt-2 w-full flex-1 border-t border-slate-800/70 px-2 py-4">
          <div className="mb-3 flex items-center justify-center text-slate-600" title="Watchlist">
            <Star size={15} />
          </div>
          <div className="space-y-2">
            {watched.length === 0 ? (
              <button
                onClick={() => navigate("/")}
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-slate-800 text-[10px] text-slate-600 transition-colors hover:border-[#8b713e] hover:text-[#c6a15b]"
                title="Add instruments from Market Watch"
              >
                +
              </button>
            ) : (
              watched.map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => navigate(`/trade/${stock.ticker}`)}
                  className="w-full rounded-md border border-slate-800 bg-[#0b1320]/70 px-1.5 py-2 text-center transition-colors hover:border-[#8b713e]/70 hover:bg-[#111a28]"
                  title={`${stock.ticker} ${signedPercent(stock.change)}`}
                >
                  <span className="block font-mono text-[11px] font-semibold text-slate-200">{stock.ticker}</span>
                  <span className={stock.change >= 0 ? "mt-1 block text-[10px] text-emerald-300" : "mt-1 block text-[10px] text-red-300"}>
                    {signedPercent(stock.change, 1)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="w-full border-t border-slate-800/80 px-2 py-4">
          <div className="mx-auto h-2 w-2 rounded-full bg-[#53d6d0]" title="Virtual funds only" />
          <p className="mt-2 text-center text-[9px] uppercase tracking-[0.14em] text-slate-600">Paper</p>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-[#060b14]/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors ${
                  isActive ? "bg-[#c6a15b]/12 text-[#c6a15b]" : "text-slate-500"
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
