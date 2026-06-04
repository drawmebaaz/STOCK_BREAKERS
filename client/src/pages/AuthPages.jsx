import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { api, apiErrorMessage } from "../utils/api.js";
import { useAuthStore } from "../stores/index.js";

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="workspace-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300">
            <ShieldCheck size={20} strokeWidth={1.8} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">StockBreakers</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        <div className="panel p-5">
          {children}
        </div>
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
