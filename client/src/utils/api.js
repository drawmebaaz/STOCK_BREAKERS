import axios from "axios";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/index.js";

const BASE = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

export const api = axios.create({
  baseURL: BASE,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

export const apiErrorMessage = (err, fallback = "Something went wrong") =>
  err.response?.data?.error || err.response?.data?.detail || err.message || fallback;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});
