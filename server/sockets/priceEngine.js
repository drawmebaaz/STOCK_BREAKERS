import { updatePrices } from "../utils/priceStore.js";
import { processPendingOrders } from "../services/orderEngine.js";
import { recordTickMetrics, setSocketClientCount } from "../utils/marketMetrics.js";

export const initPriceEngine = (io) => {
  let isTickRunning = false;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    setSocketClientCount(io.engine.clientsCount || 0);
    try {
      socket.emit("price_update", updatePrices());
    } catch (err) {
      console.warn("Initial price update failed:", err.message);
    }
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      setSocketClientCount(io.engine.clientsCount || 0);
    });
  });

  // Broadcast updated prices every 4 seconds
  const interval = setInterval(async () => {
    if (isTickRunning) {
      console.warn("Skipping market tick because the previous tick is still running");
      return;
    }

    isTickRunning = true;
    const startedAt = Date.now();
    try {
      const prices = updatePrices();
      const orderResults = await processPendingOrders();
      recordTickMetrics({
        durationMs: Date.now() - startedAt,
        activeEvents: prices.reduce((sum, quote) => Math.max(sum, quote.activeEventCount || 0), 0),
        ordersProcessed: orderResults.length,
        candlesUpdated: prices.length,
        session: prices[0]?.marketSession || "OPEN",
      });
      io.emit("price_update", prices);
    } catch (err) {
      console.warn("Price engine tick failed:", err.message);
      recordTickMetrics({ durationMs: Date.now() - startedAt, error: err.message });
    } finally {
      isTickRunning = false;
    }
  }, Number(process.env.MARKET_TICK_INTERVAL_MS || 4000));
  interval.unref?.();

  console.log("Price engine started");
};
