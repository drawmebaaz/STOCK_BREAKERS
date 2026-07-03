import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, apiErrorMessage } from "../utils/api.js";
import { useAuthStore } from "../stores/index.js";

const PROJECT_NOTES = [
  {
    title: "Order workflow",
    detail: "Review-first buy/sell tickets, cash checks, and a clear trade history.",
  },
  {
    title: "Portfolio accounting",
    detail: "Virtual cash, holdings, current value, and open gain/loss tracking.",
  },
  {
    title: "Safety framing",
    detail: "Educational simulator only. No real market orders or financial advice.",
  },
];

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="auth-shell workspace-shell">
      <div className="auth-frame">
        <section className="auth-brief">
          <div className="auth-brand">
            <p className="text-lg font-semibold text-slate-100">StockBreakers</p>
            <p className="mt-1 text-sm text-slate-500">Paper trading simulator</p>
          </div>

          <div className="auth-copy">
            <p className="stat-label">Project brief</p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-slate-50 auth-title">
              A realistic practice workspace for virtual trading decisions.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              The app focuses on the workflows an interviewer can inspect: authentication, simulated live prices,
              protected trades, holdings, trade history, and simple research panels.
            </p>
          </div>

          <div className="auth-notes">
            {PROJECT_NOTES.map(({ title: noteTitle, detail }) => (
              <div key={noteTitle} className="auth-note">
                <p className="text-sm font-semibold text-slate-200">{noteTitle}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel-section">
          <div className="auth-panel-brand">
            <p className="text-base font-semibold text-slate-100">StockBreakers</p>
            <p className="mt-1 text-xs text-slate-500">Paper trading simulator</p>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          <div className="auth-form-panel panel">{children}</div>
        </section>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, autoComplete, minLength }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div>
      <label className="stat-label mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          className="input pr-11"
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          minLength={minLength}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          <Icon size={16} strokeWidth={1.8} />
        </button>
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
      title="Sign in"
      subtitle="Open the practice workspace, monitor simulated prices, and review your portfolio."
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
        <PasswordField
          label="Password"
          placeholder="Enter password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />

        {error && <p className="alert-error">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        New here?{" "}
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
      title="Create account"
      subtitle="Start with virtual cash and use the workspace as a safe practice trading app."
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
        <PasswordField
          label="Password"
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          minLength={8}
        />

        {error && <p className="alert-error">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-slate-200 hover:text-white">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
