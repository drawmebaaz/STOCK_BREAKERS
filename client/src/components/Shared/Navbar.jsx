import React from "react";
import { Activity, LogOut } from "lucide-react";
import { useAuthStore, usePriceStore } from "../../stores/index.js";
import { currency } from "../../utils/format.js";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const connected = usePriceStore((s) => s.connected);

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-green-300 font-bold text-lg tracking-tight truncate">StockBreakers</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${
            connected ? "bg-green-400/10 text-green-300" : "bg-gray-800 text-gray-500"
          }`}
          title={connected ? "Live market stream connected" : "Connecting to live market stream"}
        >
          <Activity size={13} />
          <span className="hidden sm:inline">{connected ? "Live" : "Connecting"}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs text-gray-500">Cash balance</p>
          <p className="text-sm font-semibold text-green-300">{currency(user?.cashBalance)}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold">
          {user?.name?.[0]?.toUpperCase() || "U"}
        </div>
        <button
          onClick={logout}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-800 hover:text-red-300 transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
