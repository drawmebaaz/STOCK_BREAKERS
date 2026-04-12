import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../utils/api.js";
import { useAuthStore } from "../stores/index.js";

function AuthCard({ title, children }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-400">StockBreakers</h1>
          <p className="text-gray-500 text-sm mt-1">Paper trading · AI insights</p>
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

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input className="input" type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-gray-500 text-sm mt-4">
        No account? <Link to="/register" className="text-green-400 hover:underline">Register</Link>
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

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/register", form);
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create account">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input className="input" placeholder="Full name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password (min 6)" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account — get $50,000 virtual cash"}
        </button>
      </form>
      <p className="text-center text-gray-500 text-sm mt-4">
        Have an account? <Link to="/login" className="text-green-400 hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}
