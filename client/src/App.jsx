import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/index.js";
import { useSocket } from "./hooks/index.js";
import Navbar from "./components/Shared/Navbar.jsx";
import Sidebar from "./components/Shared/Sidebar.jsx";

const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const TradePage = lazy(() => import("./pages/TradePage.jsx"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage.jsx"));
const InsightsPage = lazy(() => import("./pages/InsightsPage.jsx"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.jsx"));

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
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6">{children}</main>
      </div>
    </div>
  );
};

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-950 text-sm text-gray-500">
    Loading...
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={
          <Protected>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/trade" element={<TradePage />} />
                <Route path="/trade/:ticker" element={<TradePage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </Protected>
        } />
      </Routes>
    </Suspense>
  );
}
