import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LineChart, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { api, apiErrorMessage } from "../utils/api.js";
import { useAuthStore } from "../stores/index.js";

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="workspace-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-800 bg-[#08101b]/95 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[620px] border-r border-slate-800 p-8 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[#8b713e]/60 bg-[#c6a15b]/10 font-mono text-sm font-bold text-[#c6a15b]">
              SB
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b713e]">StockBreakers</p>
              <h1 className="mt-1 text-lg font-semibold text-slate-100">Paper Trading Lab</h1>
            </div>
          </div>

          <div className="mt-16 max-w-md">
            <p className="stat-label">Premium brokerage simulator</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-50">
              Practice order discipline before real capital is involved.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              Practice order placement, portfolio tracking, transaction review, and risk analysis using virtual capital only.
            </p>
          </div>

          <div className="mt-10 grid gap-3">
            {[
              { Icon: WalletCards, label: "Virtual funds only", detail: "No real orders, no brokerage execution." },
              { Icon: LineChart, label: "Quant research context", detail: "Monte Carlo bands, risk metrics, and signal screeners." },
              { Icon: ShieldCheck, label: "Audit-friendly workflow", detail: "Order review, transaction ledger, and portfolio accounting." },
            ].map(({ Icon, label, detail }) => (
              <div key={label} className="rounded-md border border-slate-800 bg-[#060b14]/70 p-4">
                <div className="flex items-start gap-3">
                  <Icon size={18} className="mt-0.5 text-[#c6a15b]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-5 sm:p-8">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#8b713e]/60 bg-[#c6a15b]/10 text-[#c6a15b]">
              <ShieldCheck size={20} strokeWidth={1.8} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b713e]">StockBreakers</p>
          </div>

          <div className="mb-7">
            <div className="mb-4 hidden h-10 w-10 items-center justify-center rounded-md border border-[#8b713e]/60 bg-[#c6a15b]/10 text-[#c6a15b] lg:inline-flex">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          <div className="panel p-5">
            {children}
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-600">
            Virtual funds only. StockBreakers is an educational simulator and does not execute real trades.
          </p>
        </section>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Sign in to your trading lab"
      subtitle="Practice with virtual funds, monitor live simulated markets, and review risk before placing orders."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="stat-label mb-1.5 block">Email</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </div>
        <div>
          <label className="stat-label mb-1.5 block">Password</label>
          <input
            className="input"
            type="password"
            placeholder="Enter password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </div>

        {error && <p className="alert-error">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        New to StockBreakers?{" "}
        <Link to="/register" className="font-medium text-slate-200 hover:text-white">
          Create account
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/register", form);
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create a paper trading account"
      subtitle="Start with $50,000 in virtual cash and learn market behavior without risking real capital."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="stat-label mb-1.5 block">Full name</label>
          <input
            className="input"
            placeholder="Sourabh Rawat"
            autoComplete="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </div>
        <div>
          <label className="stat-label mb-1.5 block">Email</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </div>
        <div>
          <label className="stat-label mb-1.5 block">Password</label>
          <input
            className="input"
            type="password"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            minLength={8}
            required
          />
        </div>

        {error && <p className="alert-error">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-slate-200 hover:text-white">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
