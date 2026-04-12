import { updatePrices } from "../utils/priceStore.js";

export const initPriceEngine = (io) => {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  });

  // Broadcast updated prices every 4 seconds
  setInterval(() => {
    const prices = updatePrices();
    io.emit("price_update", prices);
  }, 4000);

  console.log("Price engine started");
};
