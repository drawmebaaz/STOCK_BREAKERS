import React, { useEffect, useRef, useState } from "react";
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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let googleScriptPromise;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="workspace-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-800 bg-[#101821] shadow-sm lg:grid-cols-[0.9fr_1fr]">
        <section className="border-b border-slate-800 p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div>
            <p className="text-lg font-semibold text-slate-100">StockBreakers</p>
            <p className="mt-1 text-sm text-slate-500">Paper trading simulator</p>
          </div>

          <div className="mt-8">
            <p className="stat-label">Project brief</p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-slate-50">
              A realistic practice workspace for virtual trading decisions.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              The app focuses on the workflows an interviewer can inspect: authentication, simulated live prices,
              protected trades, holdings, trade history, and simple research panels.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {PROJECT_NOTES.map(({ title: noteTitle, detail }) => (
              <div key={noteTitle} className="rounded-md border border-slate-800 bg-[#0b121a] p-4">
                <p className="text-sm font-semibold text-slate-200">{noteTitle}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-5 sm:p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          <div className="panel p-5">{children}</div>

          <p className="mt-5 text-xs leading-5 text-slate-600">
            This is a college project simulator. It uses virtual funds and simulated market data for learning and demos.
          </p>
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

function GoogleAuthButton({ onCredential, disabled }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [error, setError] = useState("");

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => {
            if (credential) onCredentialRef.current(credential);
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "continue_with",
          shape: "rectangular",
          width: Math.min(buttonRef.current.offsetWidth || 320, 400),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Google sign-in could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-800" />
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-600">or</span>
        <span className="h-px flex-1 bg-slate-800" />
      </div>
      <div ref={buttonRef} className="min-h-[42px] w-full" />
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
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

  const signInWithGoogle = async (credential) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/google", { credential });
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Google sign-in failed"));
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

      <GoogleAuthButton onCredential={signInWithGoogle} disabled={loading} />

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

  const signInWithGoogle = async (credential) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/google", { credential });
      setAuth(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Google sign-in failed"));
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

      <GoogleAuthButton onCredential={signInWithGoogle} disabled={loading} />

      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-slate-200 hover:text-white">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
