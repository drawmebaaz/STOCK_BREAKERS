import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/index.js";
import { useSocket } from "./hooks/index.js";
import Navbar from "./components/Shared/Navbar.jsx";
import Sidebar from "./components/Shared/Sidebar.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import TradePage from "./pages/TradePage.jsx";
import PortfolioPage from "./pages/PortfolioPage.jsx";
import InsightsPage from "./pages/InsightsPage.jsx";
import TransactionsPage from "./pages/TransactionsPage.jsx";

const Protected = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => {
  useSocket();
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={
        <Protected>
          <AppLayout>
            <Routes>
              <Route path="/"             element={<DashboardPage />} />
              <Route path="/trade"        element={<TradePage />} />
              <Route path="/trade/:ticker" element={<TradePage />} />
              <Route path="/portfolio"    element={<PortfolioPage />} />
              <Route path="/insights"     element={<InsightsPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
            </Routes>
          </AppLayout>
        </Protected>
      } />
    </Routes>
  );
}
