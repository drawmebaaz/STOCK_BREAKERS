import axios from "axios";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/index.js";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// ── Axios instance ─────────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: BASE });

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

// ── Socket ─────────────────────────────────────────────────────────────────────
export const socket = io(SOCKET_URL, { autoConnect: false });
