import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, ROLE_HOME } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Button, Field, Input, cx } from "../components/UI";
import Logo from "../components/Logo";

const ROLES = [
  { id: "manufacturer", icon: "🏭", title: "Manufacturer", text: "Submit medicines & dispatch shipments" },
  { id: "distributor", icon: "🚚", title: "Distributor", text: "Receive stock & supply pharmacies" },
  { id: "pharmacist", icon: "⚕️", title: "Pharmacist", text: "Manage inventory & bill customers" },
  { id: "customer", icon: "👤", title: "Customer", text: "Search, verify and complain" },
];

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    role: "customer", name: "", email: "", password: "", confirm: "",
    org_name: "", license_no: "", phone: "", address: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: "" });
    setError("");
  };

  const isBusiness = form.role !== "customer";

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your full name.";
    if (!form.email.trim()) next.email = "Please enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (!form.password) next.password = "Please create a password.";
    else if (form.password.length < 6) next.password = "Use at least 6 characters.";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    if (isBusiness && !form.org_name.trim()) next.org_name = "Organisation name is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await register({
        role: form.role,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        org_name: form.org_name.trim() || undefined,
        license_no: form.license_no.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      toast.success(`Account created. Welcome, ${user.name.split(" ")[0]}!`);
      navigate(ROLE_HOME[user.role] || "/");
    } catch (err) {
      setError(err.message);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-2xl animate-fade-up">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="text-lg font-bold text-ink-900">MedSure</span>
        </Link>

        <div className="card overflow-hidden">
          {/* Progress */}
          <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50/60 px-6 py-4">
            {[1, 2].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-2">
                <span className={cx("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", step >= n ? "bg-brand-600 text-white" : "bg-ink-200 text-ink-500")}>
                  {n}
                </span>
                <span className={cx("text-sm font-semibold", step >= n ? "text-ink-800" : "text-ink-400")}>
                  {n === 1 ? "Choose your role" : "Your details"}
                </span>
                {n === 1 && <span className={cx("h-px flex-1", step >= 2 ? "bg-brand-400" : "bg-ink-200")} />}
              </div>
            ))}
          </div>

          {error && (
            <div className="mx-6 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="p-6">
              <h1 className="text-xl font-bold text-ink-900">Create your account</h1>
              <p className="mt-1 text-sm text-ink-500">Select how you will use MedSure. Admin accounts are created separately.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setForm({ ...form, role: r.id }); setStep(2); }}
                    className={cx(
                      "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
                      form.role === r.id ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-ink-200 bg-white"
                    )}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-100 text-xl">{r.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">{r.title}</span>
                      <span className="block text-xs text-ink-500">{r.text}</span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-center text-sm text-ink-500">
                Already registered? <Link to="/login" className="link">Login</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-ink-900">Your details</h1>
                  <p className="mt-1 text-sm text-ink-500">
                    Registering as a{" "}
                    <span className="font-semibold text-brand-700 capitalize">{form.role}</span>
                  </p>
                </div>
                <Button variant="ghost" type="button" onClick={() => setStep(1)}>Change role</Button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors.name} required>
                  <Input value={form.name} onChange={set("name")} placeholder="Dr. Neha Kapoor" />
                </Field>
                <Field label="Email address" error={errors.email} required>
                  <Input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
                </Field>
                <Field label="Password" error={errors.password} required hint="At least 6 characters">
                  <Input type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
                </Field>
                <Field label="Confirm password" error={errors.confirm} required>
                  <Input type="password" value={form.confirm} onChange={set("confirm")} placeholder="••••••••" />
                </Field>

                {isBusiness && (
                  <>
                    <Field label={form.role === "manufacturer" ? "Company name" : "Organisation name"} error={errors.org_name} required>
                      <Input value={form.org_name} onChange={set("org_name")} placeholder="WellCare Pharmacy" />
                    </Field>
                    <Field label="License number" hint="Optional but recommended">
                      <Input value={form.license_no} onChange={set("license_no")} placeholder="PHM-2024-101" />
                    </Field>
                  </>
                )}

                <Field label="Phone">
                  <Input value={form.phone} onChange={set("phone")} placeholder="98765 00000" />
                </Field>
                <Field label="Address">
                  <Input value={form.address} onChange={set("address")} placeholder="City, State" />
                </Field>
              </div>

              <Button type="submit" loading={loading} className="mt-6 w-full py-3 text-base">
                {loading ? "Creating account..." : "Create account"}
              </Button>
              <p className="mt-4 text-center text-sm text-ink-500">
                Already registered? <Link to="/login" className="link">Login</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
