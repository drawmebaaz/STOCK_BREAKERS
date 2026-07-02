import { useCallback, useEffect } from "react";
import { socket, api, apiErrorMessage } from "../utils/api.js";
import { usePriceStore, usePortfolioStore } from "../stores/index.js";

export const useSocket = () => {
  const { setStocks, setConnected, setDegraded, setMarketStatus } = usePriceStore();

  useEffect(() => {
    let pollId = null;
    let fallbackTimer = null;
    const poll = async () => {
      try {
        const [stockResult, statusResult] = await Promise.allSettled([
          api.get("/stocks"),
          api.get("/market/status"),
        ]);
        if (stockResult.status === "fulfilled") setStocks(stockResult.value.data.stocks);
        if (statusResult.status === "fulfilled") setMarketStatus(statusResult.value.data.market);
      } catch {
        // Keep the last successful price data visible.
      }
    };
    const startPolling = () => {
      if (pollId) return;
      setDegraded(true);
      poll();
      pollId = window.setInterval(poll, 12000);
    };
    const stopPolling = () => {
      if (pollId) window.clearInterval(pollId);
      pollId = null;
      setDegraded(false);
    };
    const handleConnect = () => {
      setConnected(true);
      stopPolling();
    };
    const handleDisconnect = () => {
      setConnected(false);
      startPolling();
    };
    const handlePrices = (stocks) => {
      setStocks(stocks);
      const first = stocks?.[0];
      const market = first?.marketStatus
        ? {
            status: first.marketStatus,
            session: first.marketSession || first.marketStatus,
            regime: first.regime,
            volatilityRegime: first.volatilityRegime,
            activeEventSummary: first.activeEventSummary,
          }
        : null;
      if (market) setMarketStatus(market);
    };

    poll();

    socket.connect();
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);
    socket.on("price_update", handlePrices);

    fallbackTimer = window.setTimeout(() => {
      if (!socket.connected) startPolling();
    }, 7000);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
      socket.off("price_update", handlePrices);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      stopPolling();
      socket.disconnect();
    };
  }, [setConnected, setDegraded, setMarketStatus, setStocks]);
};

export const usePortfolio = () => {
  const { setHoldings, setSummary, setAnalytics, setLoading, setError } = usePortfolioStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [holdingsRes, summaryRes, analyticsRes] = await Promise.all([
        api.get("/portfolio"),
        api.get("/portfolio/summary"),
        api.get("/portfolio/analytics").catch(() => ({ data: { analytics: null } })),
      ]);
      setHoldings(holdingsRes.data.holdings);
      setSummary(summaryRes.data);
      if (analyticsRes.data && !analyticsRes.data.analytics) setAnalytics(analyticsRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load portfolio"));
    } finally {
      setLoading(false);
    }
  }, [setAnalytics, setError, setHoldings, setLoading, setSummary]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh };
};
