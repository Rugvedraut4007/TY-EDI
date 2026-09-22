import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, ROLE_HOME } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Button, Field, Input } from "../components/UI";
import Logo from "../components/Logo";

const DEMO = [
  { role: "Admin", email: "admin@medsure.in", password: "Admin@123", icon: "🛡️" },
  { role: "Manufacturer", email: "manufacturer@medsure.in", password: "Password@123", icon: "🏭" },
  { role: "Distributor", email: "distributor@medsure.in", password: "Password@123", icon: "🚚" },
  { role: "Pharmacist", email: "pharmacist@medsure.in", password: "Password@123", icon: "⚕️" },
  { role: "Customer", email: "customer@medsure.in", password: "Password@123", icon: "👤" },
];

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: "" });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = "Please enter your email address.";
    if (!form.password) next.password = "Please enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}!`);
      navigate(ROLE_HOME[user.role] || "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-12 lg:flex">
        <div className="pointer-events-none absolute -right-16 top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
            <Logo className="h-9 w-9" />
          </span>
          <div>
            <p className="text-xl font-bold text-white">MedSure</p>
            <p className="text-[11px] uppercase tracking-wider text-white/60">Medicine Supply Chain</p>
          </div>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight text-white">
            Trusted medicines,<br />verified supply chains.
          </h2>
          <p className="mt-4 text-white/70">
            Sign in to manage approvals, shipments, inventory, billing and the tamper-evident
            traceability ledger.
          </p>
          <div className="mt-8 space-y-3">
            {["Admin-approved medicines & fixed official prices", "Hash-chained traceability for every batch", "QR verification for customers"].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-white/80">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500/30 text-xs text-brand-200">✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">© 2026 MedSure</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-ink-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <p className="text-lg font-bold text-ink-900">MedSure</p>
          </div>

          <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500">Login to your MedSure account</p>

          {error && (
            <div className="mt-4 animate-fade-up rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Field label="Email address" error={errors.email} required>
              <Input type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} autoComplete="email" />
            </Field>

            <Field label="Password" error={errors.password} required>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="current-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-100"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            <Button type="submit" loading={loading} className="w-full py-3 text-base">
              {loading ? "Signing in..." : "Login"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-500">
            Don't have an account?{" "}
            <Link to="/register" className="link">Create one</Link>
          </p>
          <p className="mt-2 text-center text-sm text-ink-500">
            Just verifying a medicine?{" "}
            <Link to="/verify" className="link">Verify a QR code</Link>
          </p>

          {/* Demo accounts */}
          <div className="mt-7 rounded-2xl border border-ink-100 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Demo accounts — tap to fill</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => setForm({ email: d.email, password: d.password })}
                  className="flex items-center gap-2 rounded-xl border border-ink-100 px-3 py-2 text-left text-xs transition hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="text-base">{d.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-800">{d.role}</span>
                    <span className="block truncate text-ink-400">{d.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
