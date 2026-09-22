import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import {
  Button, Card, CardHeader, EmptyState, Field, Input, LoadingBlock,
  Modal, SearchInput, Select, StatCard, StatusBadge, Table, Textarea,
} from "../../components/UI";
import TraceTimeline, { ChainStages } from "../../components/TraceTimeline";

const NAV = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "medicines", label: "My Medicines", icon: "💊" },
  { id: "add", label: "Add Medicine", icon: "➕" },
  { id: "shipments", label: "Shipments", icon: "🚚" },
];

const EMPTY = {
  name: "", generic_name: "", strength: "", dosage_form: "Tablet", description: "",
  manufacturer_info: "", manufacturing_info: "", submitted_price: "",
  approval_document: "", approval_document_name: "",
};

export default function ManufacturerDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, sh] = await Promise.all([
        api.get("/stats"),
        api.get("/medicines"),
        api.get("/shipments"),
      ]);
      setStats(s);
      setMedicines(m.medicines);
      setShipments(sh.shipments);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const approved = useMemo(() => medicines.filter((m) => m.status === "approved"), [medicines]);
  const filtered = useMemo(
    () => medicines.filter((m) => (m.name + m.generic_name).toLowerCase().includes(search.toLowerCase())),
    [medicines, search]
  );

  const pendingCount = stats?.pending || 0;

  const nav = NAV.map((n) => (n.id === "medicines" ? { ...n, count: pendingCount } : n));

  return (
    <Layout
      nav={nav}
      active={tab}
      onNavigate={setTab}
      title={TABLES[tab]?.title || "Manufacturer"}
      subtitle={TABLES[tab]?.subtitle}
    >
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : (
        <>
          {tab === "overview" && <Overview stats={stats} medicines={medicines} shipments={shipments} onGo={setTab} />}
          {tab === "medicines" && (
            <MedicinesTab medicines={filtered} search={search} setSearch={setSearch} onAdd={() => setTab("add")} />
          )}
          {tab === "add" && <AddMedicine onDone={() => { setTab("medicines"); load(); }} />}
          {tab === "shipments" && <ShipmentsTab shipments={shipments} approved={approved} reload={load} />}
        </>
      )}
    </Layout>
  );
}

const TABLES = {
  overview: { title: "Manufacturer Dashboard", subtitle: "Your medicines, approvals and shipments at a glance" },
  medicines: { title: "My Medicines", subtitle: "Everything you have submitted to MedSure" },
  add: { title: "Add a Medicine", subtitle: "Submit a new medicine for admin approval" },
  shipments: { title: "Shipments", subtitle: "Dispatch medicines to distributors and track deliveries" },
};

/* ------------------------------- Overview ------------------------------ */
function Overview({ stats, medicines, shipments, onGo }) {
  const recent = medicines.slice(0, 4);
  const recentShip = shipments.slice(0, 4);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total medicines" value={stats?.medicines ?? 0} icon="💊" />
        <StatCard label="Approved" value={stats?.approved ?? 0} icon="✅" tone="brand" />
        <StatCard label="Pending approval" value={stats?.pending ?? 0} icon="⏳" tone="warn" />
        <StatCard label="Rejected" value={stats?.rejected ?? 0} icon="⛔" tone="danger" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent submissions" icon="📝"
            action={<Button variant="ghost" className="btn-sm" onClick={() => onGo("medicines")}>View all</Button>} />
          {recent.length === 0 ? (
            <EmptyState icon="💊" title="No medicines yet" message="Add your first medicine to get started."
              action={<Button onClick={() => onGo("add")}>Add medicine</Button>} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{m.name} {m.strength}</p>
                    <p className="truncate text-xs text-ink-400">{m.generic_name} · {m.dosage_form}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent shipments" icon="🚚"
            action={<Button variant="ghost" className="btn-sm" onClick={() => onGo("shipments")}>View all</Button>} />
          {recentShip.length === 0 ? (
            <EmptyState icon="🚚" title="No shipments yet" message="Dispatch an approved medicine to a distributor." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentShip.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{s.medicine_name}</p>
                    <p className="truncate text-xs text-ink-400">to {s.to_org || s.to_name} · {s.quantity} units</p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Medicines ------------------------------ */
function MedicinesTab({ medicines, search, setSearch, onAdd }) {
  return (
    <Card>
      <CardHeader
        title="Medicine catalogue"
        subtitle={`${medicines.length} medicine(s)`}
        icon="💊"
        action={
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search medicines..." className="hidden sm:block" />
            <Button onClick={onAdd}>➕ Add</Button>
          </div>
        }
      />
      {medicines.length === 0 ? (
        <EmptyState icon="💊" title="No medicines found" message="Add a medicine to submit it for admin approval."
          action={<Button onClick={onAdd}>Add medicine</Button>} />
      ) : (
        <Table headers={["Medicine", "Dosage form", "Price", "Official price", "Status", "Note"]}>
          {medicines.map((m) => (
            <tr key={m.id} className="hover:bg-ink-50/60">
              <td className="td">
                <p className="font-semibold text-ink-900">{m.name} {m.strength}</p>
                <p className="text-xs text-ink-400">{m.generic_name}</p>
              </td>
              <td className="td">{m.dosage_form}</td>
              <td className="td">₹{Number(m.submitted_price || 0).toFixed(2)}</td>
              <td className="td">
                {m.official_price ? (
                  <span className="font-semibold text-brand-700">₹{Number(m.official_price).toFixed(2)}</span>
                ) : <span className="text-ink-300">—</span>}
              </td>
              <td className="td"><StatusBadge status={m.status} /></td>
              <td className="td max-w-[220px]">
                {m.status === "rejected" ? (
                  <span className="text-xs text-red-600">{m.rejection_reason}</span>
                ) : m.status === "pending" ? (
                  <span className="text-xs text-ink-400">Awaiting admin review</span>
                ) : (
                  <span className="text-xs text-brand-600">Live in {m.available_qty || 0} units at pharmacies</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* ----------------------------- Add medicine ---------------------------- */
function AddMedicine({ onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: "" });
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (max 10MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((f) => ({ ...f, approval_document: reader.result, approval_document_name: file.name }));
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Required";
    if (!form.strength.trim()) next.strength = "Required";
    if (!form.submitted_price || Number(form.submitted_price) <= 0) next.submitted_price = "Enter a valid price";
    if (!form.approval_document) next.approval_document = "Upload the government approval document";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      await api.post("/medicines", { ...form, submitted_price: Number(form.submitted_price) });
      toast.success("Medicine submitted for approval");
      setForm(EMPTY);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Medicine information" subtitle="All fields marked * are required" icon="💊" />
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Medicine name" error={errors.name} required>
            <Input value={form.name} onChange={set("name")} placeholder="Paracetamol" />
          </Field>
          <Field label="Generic name">
            <Input value={form.generic_name} onChange={set("generic_name")} placeholder="Acetaminophen" />
          </Field>
          <Field label="Strength" error={errors.strength} required>
            <Input value={form.strength} onChange={set("strength")} placeholder="500 mg" />
          </Field>
          <Field label="Dosage form" required>
            <Select value={form.dosage_form} onChange={set("dosage_form")}>
              {["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Drops", "Inhaler", "Other"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Medicine details">
              <Textarea value={form.description} onChange={set("description")} placeholder="What is this medicine used for?" />
            </Field>
          </div>
          <Field label="Manufacturer information">
            <Input value={form.manufacturer_info} onChange={set("manufacturer_info")} placeholder="Company & location" />
          </Field>
          <Field label="Manufacturing information">
            <Input value={form.manufacturing_info} onChange={set("manufacturing_info")} placeholder="Facility / batch notes" />
          </Field>
          <Field label="Submitted price (₹)" error={errors.submitted_price} required
            hint="Admin will set the final official price">
            <Input type="number" min="0" step="0.01" value={form.submitted_price} onChange={set("submitted_price")} placeholder="25" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Government approval document" error={errors.approval_document} required>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={onFile}
                className="block w-full cursor-pointer rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-sm text-ink-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {form.approval_document_name && (
                <p className="mt-2 text-xs font-medium text-brand-700">📎 {form.approval_document_name}</p>
              )}
            </Field>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setForm(EMPTY)}>Reset</Button>
            <Button type="submit" loading={saving}>Submit for approval</Button>
          </div>
        </form>
      </Card>

      <Card className="h-fit p-5">
        <h3 className="text-sm font-semibold text-ink-900">Approval workflow</h3>
        <ol className="mt-4 space-y-4">
          {[
            ["Submit", "Provide medicine details and the government approval document."],
            ["Review", "The admin inspects the document and the submitted price."],
            ["Approve", "Admin sets the single official price used by every pharmacist."],
            ["Distribute", "Only approved medicines can be shipped to distributors."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
              <span>
                <p className="text-sm font-semibold text-ink-800">{t}</p>
                <p className="text-xs text-ink-500">{d}</p>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ------------------------------ Shipments ------------------------------ */
function ShipmentsTab({ shipments, approved, reload }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [distributors, setDistributors] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ medicine_id: "", to_id: "", quantity: "", batch_no: "", expiry_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/directory?role=distributor").then((d) => setDistributors(d.users)).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.medicine_id || !form.to_id || !form.quantity || !form.batch_no) {
      toast.error("Fill in medicine, distributor, quantity and batch number");
      return;
    }
    setSaving(true);
    try {
      await api.post("/shipments", {
        ...form,
        medicine_id: Number(form.medicine_id),
        to_id: Number(form.to_id),
        quantity: Number(form.quantity),
        expiry_date: form.expiry_date || null,
      });
      toast.success("Shipment dispatched");
      setOpen(false);
      setForm({ medicine_id: "", to_id: "", quantity: "", batch_no: "", expiry_date: "", notes: "" });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (s) => {
    try {
      const data = await api.get(`/shipments/${s.id}`);
      const trace = data.shipment.qr_id ? await api.get(`/trace/${data.shipment.qr_id}`).catch(() => null) : null;
      setDetail({ ...data, trace });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Shipments"
          subtitle={`${shipments.length} shipment(s)`}
          icon="🚚"
          action={<Button onClick={() => setOpen(true)} disabled={!approved.length}>➕ New shipment</Button>}
        />
        {shipments.length === 0 ? (
          <EmptyState icon="🚚" title="No shipments yet"
            message={approved.length ? "Dispatch an approved medicine to a distributor." : "Get a medicine approved first."} />
        ) : (
          <Table headers={["Shipment", "Medicine", "Distributor", "Qty", "Batch", "QR", "Status", ""]}>
            {shipments.map((s) => (
              <tr key={s.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{s.shipment_code}</td>
                <td className="td">
                  <p className="font-semibold text-ink-900">{s.medicine_name}</p>
                  <p className="text-xs text-ink-400">{s.strength}</p>
                </td>
                <td className="td">{s.to_org || s.to_name}</td>
                <td className="td">{s.quantity}</td>
                <td className="td font-mono text-xs">{s.batch_no}</td>
                <td className="td font-mono text-xs">{s.qr_id || "—"}</td>
                <td className="td"><StatusBadge status={s.status} /></td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => openDetail(s)}>Track</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Dispatch a shipment" subtitle="Send an approved medicine to a distributor">
        <form onSubmit={create} className="space-y-4">
          <Field label="Medicine" required>
            <Select value={form.medicine_id} onChange={(e) => setForm({ ...form, medicine_id: e.target.value })}>
              <option value="">Select an approved medicine</option>
              {approved.map((m) => (
                <option key={m.id} value={m.id}>{m.name} {m.strength} · ₹{Number(m.official_price).toFixed(2)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Distributor" required>
            <Select value={form.to_id} onChange={(e) => setForm({ ...form, to_id: e.target.value })}>
              <option value="">Select a distributor</option>
              {distributors.map((d) => <option key={d.id} value={d.id}>{d.org_name || d.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Batch number" required>
              <Input value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} placeholder="PCM20260901" />
            </Field>
            <Field label="Quantity (units)" required>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="100" />
            </Field>
          </div>
          <Field label="Expiry date">
            <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional dispatch notes" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Dispatch</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Shipment tracking" size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Shipment" value={detail.shipment.shipment_code} mono />
              <Info label="Medicine" value={`${detail.shipment.medicine_name} ${detail.shipment.strength}`} />
              <Info label="Status" value={<StatusBadge status={detail.shipment.status} />} />
              <Info label="Quantity" value={`${detail.shipment.quantity} units`} />
              <Info label="Batch" value={detail.shipment.batch_no} mono />
              <Info label="QR ID" value={detail.shipment.qr_id || "—"} mono />
            </div>

            {detail.trace && (
              <div>
                <p className="label">Traceability chain</p>
                <ChainStages stages={detail.trace.chain} />
              </div>
            )}

            <div>
              <p className="label">Status timeline</p>
              <TraceTimeline events={detail.events.map((e) => ({ ...e, event: String(e.status).toUpperCase() }))} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Info({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <div className={["mt-0.5 text-sm font-semibold text-ink-800", mono ? "font-mono text-xs" : ""].join(" ")}>{value || "—"}</div>
    </div>
  );
}
