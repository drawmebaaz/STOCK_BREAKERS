import React, { lazy, Suspense, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/index.js";
import { usePortfolio, useSocket } from "./hooks/index.js";
import Navbar from "./components/Shared/Navbar.jsx";
import Sidebar from "./components/Shared/Sidebar.jsx";

const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const TradePage = lazy(() => import("./pages/TradePage.jsx"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage.jsx"));
const InsightsPage = lazy(() => import("./pages/InsightsPage.jsx"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.jsx"));
const OrdersPage = lazy(() => import("./pages/OrdersPage.jsx"));
const DisciplinePage = lazy(() => import("./pages/DisciplinePage.jsx"));

const Protected = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useSocket();
  usePortfolio();
  return (
    <div className="workspace-shell app-shell flex overflow-hidden">
      <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="app-main flex-1 overflow-y-auto p-3 md:p-5 xl:p-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
};

const PageFallback = () => (
  <div className="workspace-shell flex min-h-screen items-center justify-center text-sm text-slate-500">
    <div className="flex items-center gap-3">
      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-500" />
      Loading workspace...
    </div>
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
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/discipline" element={<DisciplinePage />} />
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
