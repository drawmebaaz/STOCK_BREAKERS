import { updatePrices } from "../utils/priceStore.js";
import { processPendingOrders } from "../services/orderEngine.js";

export const initPriceEngine = (io) => {
  let isTickRunning = false;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    try {
      socket.emit("price_update", updatePrices());
    } catch (err) {
      console.warn("Initial price update failed:", err.message);
    }
    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  });

  // Broadcast updated prices every 4 seconds
  const interval = setInterval(async () => {
    if (isTickRunning) {
      console.warn("Skipping market tick because the previous tick is still running");
      return;
    }

    isTickRunning = true;
    try {
      const prices = updatePrices();
      await processPendingOrders();
      io.emit("price_update", prices);
    } catch (err) {
      console.warn("Price engine tick failed:", err.message);
    } finally {
      isTickRunning = false;
    }
  }, 4000);
  interval.unref?.();

  console.log("Price engine started");
};
