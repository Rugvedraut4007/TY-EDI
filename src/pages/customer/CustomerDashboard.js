import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, LoadingBlock, Modal,
  SearchInput, Select, StatCard, StatusBadge, Table, Textarea,
} from "../../components/UI";
import { ScanInput } from "../../components/QRPanel";
import { ChainStages } from "../../components/TraceTimeline";

const NAV = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "search", label: "Search Medicines", icon: "🔍" },
  { id: "verify", label: "Verify Medicine", icon: "📱" },
  { id: "complaints", label: "Complaints", icon: "📣" },
];

const CATEGORIES = [
  { id: "medicine_quality", label: "Medicine quality" },
  { id: "wrong_price", label: "Wrong price charged" },
  { id: "pharmacist_behaviour", label: "Pharmacist behaviour" },
  { id: "transaction", label: "Transaction issue" },
  { id: "fake_medicine", label: "Suspected fake medicine" },
  { id: "other", label: "Other" },
];

export default function CustomerDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([api.get("/stats"), api.get("/complaints")]);
      setStats(s);
      setComplaints(c.complaints);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openComplaints = complaints.filter((c) => ["pending", "under_review"].includes(c.status)).length;
  const nav = NAV.map((n) => (n.id === "complaints" ? { ...n, count: openComplaints } : n));

  return (
    <Layout nav={nav} active={tab} onNavigate={setTab} title={TITLES[tab].title} subtitle={TITLES[tab].subtitle}>
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : (
        <>
          {tab === "overview" && <Overview stats={stats} complaints={complaints} onGo={setTab} />}
          {tab === "search" && <SearchTab />}
          {tab === "verify" && <VerifyTab />}
          {tab === "complaints" && <ComplaintsTab complaints={complaints} reload={load} />}
        </>
      )}
    </Layout>
  );
}

const TITLES = {
  overview: { title: "Customer Dashboard", subtitle: "Search, verify and report medicines" },
  search: { title: "Search Medicines", subtitle: "Find medicines and their official prices" },
  verify: { title: "Verify Medicine", subtitle: "Scan a QR code to check the supply chain" },
  complaints: { title: "Complaints", subtitle: "Raise issues and track their resolution" },
};

/* ------------------------------- Overview ------------------------------ */
function Overview({ stats, complaints, onGo }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="My complaints" value={stats?.complaints ?? 0} icon="📣" tone="info" />
        <StatCard label="Open complaints" value={stats?.openComplaints ?? 0} icon="⏳" tone="warn" />
        <StatCard label="Bills on record" value={stats?.bills ?? 0} icon="🧾" tone="ink" />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink-900">What would you like to do?</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { id: "search", icon: "🔍", title: "Search a medicine", text: "See details, manufacturer and official price" },
            { id: "verify", icon: "📱", title: "Verify a QR code", text: "Check if the supply chain is complete" },
            { id: "complaints", icon: "📣", title: "Raise a complaint", text: "Report a medicine, pharmacist or transaction" },
          ].map((a) => (
            <button key={a.id} onClick={() => onGo(a.id)}
              className="flex items-start gap-3 rounded-2xl border border-ink-100 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-xl">{a.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-ink-800">{a.title}</span>
                <span className="block text-xs text-ink-500">{a.text}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink-400">
          Have a pharmacy bill?{" "}
          <Link to="/verify-bill" className="link">Verify a bill</Link>
        </p>
      </Card>

      <Card>
        <CardHeader title="My recent complaints" icon="📣"
          action={<Button variant="ghost" className="btn-sm" onClick={() => onGo("complaints")}>View all</Button>} />
        {complaints.length === 0 ? (
          <EmptyState icon="📣" title="No complaints" message="You haven't raised any complaints yet." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {complaints.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-800">{CATEGORIES.find((x) => x.id === c.category)?.label || c.category}</p>
                  <p className="truncate text-xs text-ink-400">{c.complaint_code} · {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Search tab ----------------------------- */
function SearchTab() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const data = await api.get(`/medicines/public?search=${encodeURIComponent(q)}`, { auth: false });
      setMedicines(data.medicines);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(""); }, [load]);

  const submit = (e) => {
    e.preventDefault();
    load(search);
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search Paracetamol, Amoxicillin..." className="flex-1" />
          <Button type="submit">Search</Button>
        </form>
        <p className="mt-3 text-xs text-ink-400">
          Popular:
          {["Paracetamol", "Amoxicillin", "Azithromycin"].map((p) => (
            <button key={p} className="link ml-2" onClick={() => { setSearch(p); load(p); }}>{p}</button>
          ))}
        </p>
      </Card>

      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : medicines.length === 0 ? (
        <Card><EmptyState icon="🔍" title="No medicines found" message="Try a different name or generic name." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {medicines.map((m) => (
            <Card key={m.id} className="animate-fade-up overflow-hidden transition hover:-translate-y-1 hover:shadow-pop">
              <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-brand-50 to-white px-5 py-4">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl shadow-card">💊</span>
                <span className="text-lg font-bold text-brand-700">₹{Number(m.official_price).toFixed(2)}</span>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-ink-900">{m.name}</h3>
                <p className="text-xs text-ink-500">{m.generic_name} · {m.strength} · {m.dosage_form}</p>
                <p className="mt-2 text-xs text-ink-400">by {m.manufacturer_org || m.manufacturer_name}</p>
                <div className="mt-3 flex items-center justify-end">
                  <Button variant="ghost" className="btn-sm" onClick={() => setSelected(m)}>Details</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${selected.name} ${selected.strength}` : ""} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Generic name" value={selected.generic_name} />
              <Info label="Dosage form" value={selected.dosage_form} />
              <Info label="Official price" value={`₹${Number(selected.official_price).toFixed(2)}`} highlight />
              <Info label="Manufacturer" value={selected.manufacturer_org || selected.manufacturer_name} />
              <Info label="Status" value={<Badge status="approved">Approved by MedSure</Badge>} />
            </div>
            {selected.description && (
              <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{selected.description}</p>
            )}
            <p className="text-xs text-ink-400">
              The official price is centrally controlled and the same at every MedSure pharmacy.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ Verify tab ----------------------------- */
function VerifyTab() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onScan = async (code) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.get(`/verify/${encodeURIComponent(code)}`, { auth: false });
      if (!data.verified) setError(data.message || "This medicine could not be verified");
      setResult(data);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink-900">Scan or enter a QR code</h3>
        <p className="mb-3 text-xs text-ink-500">Each QR code identifies a specific medicine batch and package.</p>
        <ScanInput onScan={onScan} buttonLabel="Verify" />
      </Card>

      {loading && <Card><LoadingBlock label="Verifying..." /></Card>}

      {error && !loading && (
        <Card className="border-red-200 bg-red-50 p-6 text-center">
          <div className="text-3xl">⚠️</div>
          <h3 className="mt-2 text-lg font-bold text-red-800">Verification failed</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </Card>
      )}

      {result && result.verified && !loading && (
        <Card className="animate-fade-up overflow-hidden">
          <div className={result.complete ? "bg-brand-50 px-5 py-4" : "bg-amber-50 px-5 py-4"}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl">{result.complete ? "✅" : "⚠️"}</span>
              <div>
                <p className="text-base font-bold text-ink-900">
                  {result.complete ? "Supply chain verified" : "Verification incomplete"}
                </p>
                <p className="text-xs text-ink-600">
                  {result.complete ? "This package passed through every required stage." : "A stage is missing — flagged for admin."}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-bold text-ink-900">{result.medicine.medicine_name}</h2>
              <p className="text-sm text-ink-500">{result.medicine.generic_name} · {result.medicine.strength}</p>
            </div>
            <ChainStages stages={result.stages} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Official price" value={`₹${Number(result.medicine.official_price).toFixed(2)}`} highlight />
              <Info label="Batch" value={result.medicine.batch_no} />
              <Info label="Manufacturer" value={result.medicine.manufacturer_org || result.medicine.manufacturer_name} />
              <Info label="Expiry" value={result.medicine.expiry_date ? new Date(result.medicine.expiry_date).toLocaleDateString() : "—"} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------- Complaints tab --------------------------- */
function ComplaintsTab({ complaints, reload }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [form, setForm] = useState({ category: "medicine_quality", medicine_id: "", pharmacist_id: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/medicines/public", { auth: false }).then((d) => setMedicines(d.medicines)).catch(() => {});
    api.get("/directory?role=pharmacist").then((d) => setPharmacists(d.users)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return toast.error("Please describe the issue");
    setBusy(true);
    try {
      await api.post("/complaints", {
        category: form.category,
        medicine_id: form.medicine_id ? Number(form.medicine_id) : null,
        pharmacist_id: form.pharmacist_id ? Number(form.pharmacist_id) : null,
        description: form.description,
      });
      toast.success("Complaint submitted to the admin");
      setOpen(false);
      setForm({ category: "medicine_quality", medicine_id: "", pharmacist_id: "", description: "" });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="My complaints" subtitle={`${complaints.length} complaint(s)`} icon="📣"
          action={<Button onClick={() => setOpen(true)}>➕ New complaint</Button>} />
        {complaints.length === 0 ? (
          <EmptyState icon="📣" title="No complaints" message="Report any issue with a medicine, pharmacist or transaction."
            action={<Button onClick={() => setOpen(true)}>Raise a complaint</Button>} />
        ) : (
          <Table headers={["Code", "Category", "Medicine", "Status", "Raised", ""]}>
            {complaints.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{c.complaint_code}</td>
                <td className="td">{CATEGORIES.find((x) => x.id === c.category)?.label || c.category}</td>
                <td className="td">{c.medicine_name || "—"}</td>
                <td className="td"><StatusBadge status={c.status} /></td>
                <td className="td text-xs text-ink-400">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => setDetail(c)}>View</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Raise a complaint" subtitle="Your complaint goes straight to the admin">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Category" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medicine (optional)">
              <Select value={form.medicine_id} onChange={(e) => setForm({ ...form, medicine_id: e.target.value })}>
                <option value="">Not applicable</option>
                {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}
              </Select>
            </Field>
            <Field label="Pharmacist (optional)">
              <Select value={form.pharmacist_id} onChange={(e) => setForm({ ...form, pharmacist_id: e.target.value })}>
                <option value="">Not applicable</option>
                {pharmacists.map((p) => <option key={p.id} value={p.id}>{p.org_name || p.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what happened, including any bill number or batch information." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Submit complaint</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Complaint details" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-ink-800">{detail.complaint_code}</span>
              <StatusBadge status={detail.status} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Category" value={CATEGORIES.find((x) => x.id === detail.category)?.label || detail.category} />
              <Info label="Medicine" value={detail.medicine_name || "—"} />
              <Info label="Pharmacist" value={detail.pharmacist_org || detail.pharmacist_name || "—"} />
              <Info label="Raised on" value={new Date(detail.created_at).toLocaleString()} />
            </div>
            <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">{detail.description}</div>
            {detail.admin_note && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
                <p className="text-xs font-semibold uppercase tracking-wide">Admin response</p>
                <p className="mt-1">{detail.admin_note}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Info({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <div className={["mt-0.5 text-sm font-semibold", highlight ? "text-brand-700 text-base" : "text-ink-800"].join(" ")}>{value || "—"}</div>
    </div>
  );
}
