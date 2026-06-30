import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      updateBalance: (cashBalance) =>
        set((state) => ({ user: state.user ? { ...state.user, cashBalance } : null })),
      updateWatchlist: (watchlist) =>
        set((state) => ({ user: state.user ? { ...state.user, watchlist } : null })),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: "stockbreakers-auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export const usePriceStore = create((set) => ({
  stocks: [],
  priceMap: {},
  connected: false,
  degraded: false,
  marketStatus: null,
  lastUpdated: null,
  setStocks: (stocks) => {
    const priceMap = stocks.reduce((acc, stock) => {
      acc[stock.ticker] = stock.price;
      return acc;
    }, {});
    set({ stocks, priceMap, lastUpdated: new Date().toISOString() });
  },
  setConnected: (connected) => set({ connected }),
  setDegraded: (degraded) => set({ degraded }),
  setMarketStatus: (marketStatus) => set({ marketStatus }),
}));

export const usePortfolioStore = create((set) => ({
  holdings: [],
  summary: null,
  analytics: null,
  loading: false,
  error: "",
  setHoldings: (holdings) => set({ holdings }),
  setSummary: (summary) => set({ summary }),
  setAnalytics: (analytics) => set({ analytics }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
