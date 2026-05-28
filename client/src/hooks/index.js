import { useCallback, useEffect } from "react";
import { socket, api, apiErrorMessage } from "../utils/api.js";
import { usePriceStore, usePortfolioStore } from "../stores/index.js";

export const useSocket = () => {
  const { setStocks, setConnected } = usePriceStore();

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    api.get("/stocks").then(({ data }) => setStocks(data.stocks)).catch(() => {});

    socket.connect();
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("price_update", setStocks);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("price_update", setStocks);
      socket.disconnect();
    };
  }, [setConnected, setStocks]);
};

export const usePortfolio = () => {
  const { setHoldings, setSummary, setLoading, setError } = usePortfolioStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [holdingsRes, summaryRes] = await Promise.all([
        api.get("/portfolio"),
        api.get("/portfolio/summary"),
      ]);
      setHoldings(holdingsRes.data.holdings);
      setSummary(summaryRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load portfolio"));
    } finally {
      setLoading(false);
    }
  }, [setError, setHoldings, setLoading, setSummary]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh };
};
