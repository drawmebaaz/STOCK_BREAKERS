import React from "react";
import { useAuthStore, usePriceStore } from "../../stores/index.js";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const connected = usePriceStore((s) => s.connected);

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-green-400 font-bold text-lg tracking-tight">StockBreakers</span>
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-600"}`} title={connected ? "Live" : "Connecting..."} />
        {connected && <span className="text-xs text-gray-500">Live</span>}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-500">Cash balance</p>
          <p className="text-sm font-semibold text-green-400">
            ${user?.cashBalance?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
          Sign out
        </button>
      </div>
    </header>
  );
}
