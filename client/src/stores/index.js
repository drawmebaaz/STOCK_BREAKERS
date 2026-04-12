import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Auth Store ────────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      updateBalance: (cashBalance) => set((s) => ({ user: { ...s.user, cashBalance } })),
      logout: () => set({ user: null, token: null }),
    }),
    { name: "auth-storage" }
  )
);

// ── Price Store (live via socket) ─────────────────────────────────────────────
export const usePriceStore = create((set) => ({
  stocks: [],
  priceMap: {},     // { AAPL: 189.5, MSFT: 415.2, ... }
  connected: false,
  setStocks: (stocks) => {
    const priceMap = stocks.reduce((acc, s) => ({ ...acc, [s.ticker]: s.price }), {});
    set({ stocks, priceMap });
  },
  setConnected: (connected) => set({ connected }),
}));

// ── Portfolio Store ───────────────────────────────────────────────────────────
export const usePortfolioStore = create((set) => ({
  holdings: [],
  summary: null,
  loading: false,
  setHoldings: (holdings) => set({ holdings }),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ loading }),
}));
