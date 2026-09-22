import { Link } from "react-router-dom";
import { Card } from "../components/UI";
import Logo from "../components/Logo";

const FEATURES = [
  { icon: "🏭", title: "Manufacturer onboarding", text: "Submit medicines with government approval documents and centrally approved pricing." },
  { icon: "🚚", title: "Supply-chain shipments", text: "Track every hop from Manufacturer to Distributor to Pharmacist with live statuses." },
  { icon: "🔗", title: "Tamper-evident ledger", text: "Every batch movement is hash-chained so history cannot be quietly altered." },
  { icon: "📱", title: "QR verification", text: "Customers scan a package QR to see the verified chain and official price." },
  { icon: "💰", title: "One official price", text: "Admin controls the price so the same medicine costs the same at every pharmacy." },
  { icon: "🧾", title: "Pharmacy billing", text: "Built-in POS bills customers at the official price with digital verification." },
];

const ROLES = [
  { icon: "🏭", title: "Manufacturer", text: "Register medicines, upload approvals, dispatch shipments." },
  { icon: "🚚", title: "Distributor", text: "Receive via QR, manage inventory, partial dispatch to pharmacies." },
  { icon: "⚕️", title: "Pharmacist", text: "Receive stock, bill customers, keep the official price intact." },
  { icon: "👤", title: "Customer", text: "Search medicines, verify QR codes, raise complaints." },
  { icon: "🛡️", title: "Admin", text: "Approve medicines, set prices, monitor the whole chain." },
];

const STEPS = [
  { n: "01", title: "Submit", text: "Manufacturer submits a medicine with its government approval document." },
  { n: "02", title: "Approve", text: "Admin reviews the document and sets the single official price." },
  { n: "03", title: "Track", text: "Each movement is written to the hash-chained traceability ledger." },
  { n: "04", title: "Verify", text: "Customers scan the QR and see a verified supply chain." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo className="h-10 w-10" />
            <div>
              <p className="text-lg font-bold leading-tight text-ink-900">MedSure</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Medicine Supply Chain</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/verify" className="btn btn-outline btn-sm sm:px-4 sm:py-2.5 sm:text-sm">Verify QR</Link>
            <Link to="/login" className="btn-ghost btn-sm sm:px-4 sm:py-2.5 sm:text-sm">Login</Link>
            <Link to="/register" className="btn-primary btn-sm sm:px-4 sm:py-2.5 sm:text-sm">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-40 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="badge bg-brand-50 text-brand-700">Central Medicine Tracking & Management</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-5xl">
              Every medicine, <span className="text-brand-600">one trusted chain</span>.
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-500 sm:text-lg">
              MedSure connects Manufacturers, Distributors, Pharmacists, Customers and Admins on a single
              platform — with admin-approved medicines, a fixed official price and a tamper-evident
              traceability ledger you can actually verify.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary px-6 py-3 text-base">Create an account</Link>
              <Link to="/verify" className="btn-outline px-6 py-3 text-base">Verify a medicine QR</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {[
                ["5", "Connected roles"],
                ["₹0", "Price disputes"],
                ["100%", "Chain verified"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-ink-900">{value}</p>
                  <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up">
            <Card className="overflow-hidden p-0 shadow-pop">
              <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-brand-400" />
                <span className="ml-2 text-xs font-medium text-ink-500">Paracetamol 500 mg · Batch PCM20260901</span>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                  <span className="text-sm font-semibold text-brand-800">✓ Verified supply chain</span>
                  <span className="text-lg font-bold text-brand-700">₹25.00</span>
                </div>
                {[
                  ["🏭", "Manufacturer", "Cipla Pharmaceuticals", true],
                  ["🚚", "Distributor", "MediTrans Distribution", true],
                  ["⚕️", "Pharmacist", "WellCare Pharmacy", true],
                ].map(([icon, role, name, ok]) => (
                  <div key={role} className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-lg">{icon}</span>
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wide text-ink-400">{role}</p>
                      <p className="text-sm font-semibold text-ink-800">{name}</p>
                    </div>
                    <span className={ok ? "text-brand-600" : "text-ink-300"}>{ok ? "✓" : "✗"}</span>
                  </div>
                ))}
                <p className="rounded-xl bg-ink-900 px-4 py-3 font-mono text-[11px] text-brand-300">
                  hash 7f3a9c…← prev a21b4e…
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-ink-900">Built for the whole supply chain</h2>
          <p className="mt-2 text-ink-500">From approval documents to the customer's QR scan, nothing is left untracked.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="animate-fade-up p-6 transition hover:-translate-y-1 hover:shadow-pop">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl">{f.icon}</span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="bg-ink-900 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-white">How MedSure works</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <p className="text-3xl font-extrabold text-brand-400">{s.n}</p>
                <h3 className="mt-3 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-white/60">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold text-ink-900">Five roles, one platform</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <Card key={r.title} className="p-5 text-center transition hover:-translate-y-1 hover:shadow-pop">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-2xl">{r.icon}</span>
              <h3 className="mt-3 text-sm font-semibold text-ink-900">{r.title}</h3>
              <p className="mt-1 text-xs text-ink-500">{r.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-brand-600 to-brand-800 px-8 py-12 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to make medicines trustworthy?</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-50">
            Join as a manufacturer, distributor, pharmacist or customer and start tracking today.
          </p>
          <Link to="/register" className="btn mt-6 bg-white px-6 py-3 text-base text-brand-700 hover:bg-brand-50">
            Get started free
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8">
        <p className="text-center text-sm text-ink-400">© 2026 MedSure · Central Medicine Tracking & Management System</p>
      </footer>
    </div>
  );
}
