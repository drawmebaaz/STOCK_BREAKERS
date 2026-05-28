import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LineChart } from "lucide-react";
import { api, apiErrorMessage } from "../utils/api.js";
import { useAuthStore } from "../stores/index.js";

function AuthCard({ title, children }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-green-500/10 text-green-300">
            <LineChart size={24} />
          </div>
          <h1 className="text-2xl font-bold text-green-300">StockBreakers</h1>
          <p className="text-gray-500 text-sm mt-1">Paper trading with AI risk insights</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-6">{title}</h2>
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
    <AuthCard title="Welcome back">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-center text-gray-500 text-sm mt-4">
        No account? <Link to="/register" className="text-green-300 hover:underline">Register</Link>
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
    <AuthCard title="Create account">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          className="input"
          placeholder="Full name"
          autoComplete="name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password (min 8)"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          minLength={8}
          required
        />
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account with $50,000 virtual cash"}
        </button>
      </form>
      <p className="text-center text-gray-500 text-sm mt-4">
        Have an account? <Link to="/login" className="text-green-300 hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}
