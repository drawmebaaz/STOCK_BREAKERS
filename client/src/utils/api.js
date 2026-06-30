import axios from "axios";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/index.js";
import { createDemoApi, demoSocket } from "./demoApi.js";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const BASE = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

const realApi = axios.create({
  baseURL: BASE,
  timeout: 8000,
});

realApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

realApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

export const api = DEMO_MODE ? createDemoApi() : realApi;

export const apiErrorMessage = (err, fallback = "Something went wrong") =>
  err.code === "ECONNABORTED"
    ? "The request took too long. Please retry."
    : err.response?.data?.error || err.response?.data?.detail || err.message || fallback;

export const socket = DEMO_MODE ? demoSocket : io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  timeout: 6000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1200,
});
