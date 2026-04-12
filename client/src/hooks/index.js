import { useEffect } from "react";
import { socket, api } from "../utils/api.js";
import { usePriceStore, usePortfolioStore } from "../stores/index.js";

// ── useSocket: connect on mount, update price store on events ─────────────────
export const useSocket = () => {
  const { setStocks, setConnected } = usePriceStore();

  useEffect(() => {
    socket.connect();
    socket.on("connect",      () => setConnected(true));
    socket.on("disconnect",   () => setConnected(false));
    socket.on("price_update", setStocks);

    return () => {
      socket.off("price_update", setStocks);
      socket.disconnect();
    };
  }, []);
};

// ── usePortfolio: fetch holdings + summary ────────────────────────────────────
export const usePortfolio = () => {
  const { setHoldings, setSummary, setLoading } = usePortfolioStore();

  const refresh = async () => {
    setLoading(true);
    try {
      const [holdingsRes, summaryRes] = await Promise.all([
        api.get("/portfolio"),
        api.get("/portfolio/summary"),
      ]);
      setHoldings(holdingsRes.data.holdings);
      setSummary(summaryRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  return { refresh };
};
