import { useCallback, useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, LoadingBlock, Modal,
  SearchInput, Select, StatCard, StatusBadge, Table, Textarea,
} from "../../components/UI";
import { Donut } from "../../components/Charts";
import TraceTimeline, { ChainStages, ChainStatus } from "../../components/TraceTimeline";
import { ScanInput } from "../../components/QRPanel";

const NAV = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "approvals", label: "Approvals", icon: "✅" },
  { id: "prices", label: "Official Prices", icon: "💰" },
  { id: "medicines", label: "Medicines", icon: "💊" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "shipments", label: "Shipments", icon: "🚚" },
  { id: "traceability", label: "Traceability", icon: "🔗" },
  { id: "flags", label: "Flagged", icon: "⚠️" },
  { id: "complaints", label: "Complaints", icon: "📣" },
];

const ROLE_TABS = ["manufacturer", "distributor", "pharmacist", "customer"];

export default function AdminDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [flags, setFlags] = useState([]);
  const [ledger, setLedger] = useState({ ledger: [], intact: true });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, m, sh, u, c, f, l] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/medicines/pending"),
        api.get("/medicines"),
        api.get("/shipments"),
        api.get("/admin/users"),
        api.get("/complaints"),
        api.get("/trace/admin/flags"),
        api.get("/trace/admin/ledger"),
      ]);
      setStats(s);
      setPending(p.medicines);
      setMedicines(m.medicines);
      setShipments(sh.shipments);
      setUsers(u.users);
      setComplaints(c.complaints);
      setFlags(f.flags);
      setLedger(l);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openComplaints = complaints.filter((c) => ["pending", "under_review"].includes(c.status)).length;
  const nav = NAV.map((n) => {
    if (n.id === "approvals") return { ...n, count: pending.length };
    if (n.id === "flags") return { ...n, count: flags.length };
    if (n.id === "complaints") return { ...n, count: openComplaints };
    return n;
  });

  const filteredMedicines = medicines.filter((m) =>
    (m.name + m.generic_name + (m.manufacturer_org || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout nav={nav} active={tab} onNavigate={setTab} title={TITLES[tab].title} subtitle={TITLES[tab].subtitle}>
      {loading ? (
        <Card><LoadingBlock label="Loading the control centre..." /></Card>
      ) : (
        <>
          {tab === "overview" && <Overview stats={stats} flags={flags} complaints={complaints} onGo={setTab} />}
          {tab === "approvals" && <Approvals pending={pending} reload={load} />}
          {tab === "prices" && (
            <Prices medicines={medicines.filter((m) => m.status === "approved")} search={search} setSearch={setSearch} reload={load} />
          )}
          {tab === "medicines" && (
            <Medicines medicines={filteredMedicines} search={search} setSearch={setSearch} />
          )}
          {tab === "users" && <Users users={users} />}
          {tab === "shipments" && <Shipments shipments={shipments} />}
          {tab === "traceability" && <Traceability ledger={ledger} reload={load} />}
          {tab === "flags" && <Flags flags={flags} />}
          {tab === "complaints" && <Complaints complaints={complaints} reload={load} />}
        </>
      )}
    </Layout>
  );
}

const TITLES = {
  overview: { title: "Admin Control Centre", subtitle: "Monitor the entire MedSure platform" },
  approvals: { title: "Medicine Approvals", subtitle: "Review submissions and set official prices" },
  prices: { title: "Official Prices", subtitle: "One centrally controlled price for every pharmacy" },
  medicines: { title: "All Medicines", subtitle: "Every medicine registered in MedSure" },
  users: { title: "Users", subtitle: "Manufacturers, distributors, pharmacists and customers" },
  shipments: { title: "Shipment Monitoring", subtitle: "Track every hop across the supply chain" },
  traceability: { title: "Traceability Ledger", subtitle: "Tamper-evident, hash-chained batch history" },
  flags: { title: "Flagged Batches", subtitle: "Incomplete Manufacturer → Distributor → Pharmacist chains" },
  complaints: { title: "Complaints", subtitle: "Customer issues requiring admin attention" },
};

/* ------------------------------- Overview ------------------------------ */
function Overview({ stats, flags, complaints, onGo }) {
  const c = stats?.counts || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending approvals" value={c.pendingMedicines ?? 0} icon="⏳" tone="warn"
          hint={`${c.approvedMedicines ?? 0} approved · ${c.rejectedMedicines ?? 0} rejected`} />
        <StatCard label="Shipments" value={c.shipments ?? 0} icon="🚚" tone="info" hint={`${c.inTransit ?? 0} in transit`} />
        <StatCard label="Bills issued" value={c.bills ?? 0} icon="🧾" hint={`₹${Number(c.revenue || 0).toFixed(2)} total`} />
        <StatCard label="Open complaints" value={c.openComplaints ?? 0} icon="📣" tone="danger" hint={`${c.complaints ?? 0} total`} />
      </div>

      <div className="mx-auto w-full max-w-lg">
        <Donut title="Medicines by status" subtitle="Approval pipeline" data={stats?.statusBreakdown || []} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { role: "Manufacturers", value: c.manufacturers, icon: "🏭" },
          { role: "Distributors", value: c.distributors, icon: "🚚" },
          { role: "Pharmacists", value: c.pharmacists, icon: "⚕️" },
          { role: "Customers", value: c.customers, icon: "👤" },
        ].map((x) => (
          <Card key={x.role} className="flex items-center gap-3 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-100 text-xl">{x.icon}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{x.role}</p>
              <p className="text-xl font-bold text-ink-900">{x.value ?? 0}</p>
            </div>
          </Card>
        ))}
      </div>

      {(flags.length > 0 || complaints.filter((x) => x.status === "pending").length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {flags.length > 0 && (
            <Card className="border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">{flags.length} batch(es) flagged</p>
                  <p className="text-xs text-red-700">Some batches are missing a supply-chain stage.</p>
                  <Button variant="danger" className="btn-sm mt-3" onClick={() => onGo("flags")}>Investigate</Button>
                </div>
              </div>
            </Card>
          )}
          {complaints.filter((x) => x.status === "pending").length > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl">📣</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    {complaints.filter((x) => x.status === "pending").length} new complaint(s)
                  </p>
                  <p className="text-xs text-amber-700">Customers are waiting for a response.</p>
                  <Button variant="outline" className="btn-sm mt-3" onClick={() => onGo("complaints")}>Review</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Approvals ------------------------------ */
function Approvals({ pending, reload }) {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const open = (m) => {
    setSelected(m);
    setPrice(String(m.submitted_price || ""));
    setReason("");
  };

  const approve = async () => {
    if (!price || Number(price) <= 0) return toast.error("Enter a valid official price");
    setBusy(true);
    try {
      await api.post(`/medicines/${selected.id}/approve`, { official_price: Number(price) });
      toast.success(`${selected.name} approved at ₹${Number(price).toFixed(2)}`);
      setSelected(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reason.trim()) return toast.error("Provide a rejection reason");
    setBusy(true);
    try {
      await api.post(`/medicines/${selected.id}/reject`, { reason });
      toast.success(`${selected.name} rejected`);
      setSelected(null);
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
        <CardHeader title="Pending submissions" subtitle={`${pending.length} awaiting review`} icon="⏳" />
        {pending.length === 0 ? (
          <EmptyState icon="✅" title="No pending submissions" message="Every manufacturer submission has been reviewed." />
        ) : (
          <Table headers={["Medicine", "Manufacturer", "Submitted price", "Document", "Submitted", ""]}>
            {pending.map((m) => (
              <tr key={m.id} className="hover:bg-ink-50/60">
                <td className="td">
                  <p className="font-semibold text-ink-900">{m.name} {m.strength}</p>
                  <p className="text-xs text-ink-400">{m.generic_name} · {m.dosage_form}</p>
                </td>
                <td className="td">{m.manufacturer_org || m.manufacturer_name}</td>
                <td className="td font-semibold">₹{Number(m.submitted_price).toFixed(2)}</td>
                <td className="td">
                  {m.approval_document || m.approval_document_name
                    ? <Badge status="info">📎 {m.approval_document_name || "document"}</Badge>
                    : <span className="text-xs text-ink-300">none</span>}
                </td>
                <td className="td text-xs text-ink-400">{new Date(m.created_at).toLocaleDateString()}</td>
                <td className="td text-right">
                  <Button className="btn-sm" onClick={() => open(m)}>Review</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Review submission" size="lg"
        subtitle={selected ? `${selected.name} ${selected.strength}` : ""}>
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Medicine" value={`${selected.name} ${selected.strength}`} />
              <Info label="Generic name" value={selected.generic_name} />
              <Info label="Dosage form" value={selected.dosage_form} />
              <Info label="Manufacturer" value={selected.manufacturer_org || selected.manufacturer_name} />
              <Info label="Manufacturer info" value={selected.manufacturer_info} />
              <Info label="Manufacturing info" value={selected.manufacturing_info} />
              <Info label="Submitted price" value={`₹${Number(selected.submitted_price).toFixed(2)}`} />
              <Info label="Submitted on" value={new Date(selected.created_at).toLocaleString()} />
            </div>

            {selected.description && (
              <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{selected.description}</p>
            )}

            <div className="flex items-center justify-between rounded-xl border border-ink-100 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">Government approval document</p>
                <p className="text-xs text-ink-500">{selected.approval_document_name || "Approval document"}</p>
              </div>
              <Button variant="outline" className="btn-sm" onClick={() => setDocOpen(true)}>👁 View document</Button>
            </div>

            <Field label="Official price (₹)" hint="This price will apply at every pharmacy and cannot be changed by them">
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>

            <Field label="Rejection reason" hint="Required only if you reject this submission">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this submission is rejected" />
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="danger" loading={busy} onClick={reject}>Reject</Button>
              <Button loading={busy} onClick={approve}>Approve at ₹{price || "0"}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Approval document" size="lg">
        <DocumentViewer doc={selected?.approval_document} name={selected?.approval_document_name} />
      </Modal>
    </>
  );
}

function DocumentViewer({ doc, name }) {
  if (!doc) {
    return <p className="py-8 text-center text-sm text-ink-400">No document was uploaded for this submission.</p>;
  }
  if (doc.startsWith("data:image")) {
    return <img src={doc} alt={name} className="mx-auto max-h-[60vh] rounded-xl border border-ink-100" />;
  }
  if (doc.startsWith("data:")) {
    return (
      <div className="space-y-3">
        <iframe title="document" src={doc} className="h-[60vh] w-full rounded-xl border border-ink-100" />
        <a className="link text-sm" href={doc} download={name || "approval-document"}>Download document</a>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-ink-500">Document reference: <span className="font-mono">{doc}</span></p>
      <a className="link text-sm" href={doc} target="_blank" rel="noreferrer">Open document</a>
    </div>
  );
}

/* -------------------------------- Prices ------------------------------- */
function Prices({ medicines, search, setSearch, reload }) {
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!price || Number(price) <= 0) return toast.error("Enter a valid price");
    setBusy(true);
    try {
      await api.patch(`/medicines/${edit.id}/price`, { official_price: Number(price) });
      toast.success("Official price updated");
      setEdit(null);
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
        <CardHeader title="Official price list" subtitle={`${medicines.length} approved medicine(s)`} icon="💰"
          action={<SearchInput value={search} onChange={setSearch} placeholder="Search medicines" className="hidden sm:block" />} />
        {medicines.length === 0 ? (
          <EmptyState icon="💰" title="No approved medicines" message="Approve a submission to set its official price." />
        ) : (
          <Table headers={["Medicine", "Manufacturer", "Official price", ""]}>
            {medicines.map((m) => (
              <tr key={m.id} className="hover:bg-ink-50/60">
                <td className="td">
                  <p className="font-semibold text-ink-900">{m.name} {m.strength}</p>
                  <p className="text-xs text-ink-400">{m.generic_name}</p>
                </td>
                <td className="td">{m.manufacturer_org || m.manufacturer_name}</td>
                <td className="td"><span className="text-base font-bold text-brand-700">₹{Number(m.official_price).toFixed(2)}</span></td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => { setEdit(m); setPrice(String(m.official_price)); }}>
                    Update price
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Update official price" size="sm"
        subtitle={edit ? `${edit.name} ${edit.strength}` : ""}>
        {edit && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
              <span className="text-sm text-ink-600">Current price</span>
              <span className="font-bold text-ink-900">₹{Number(edit.official_price).toFixed(2)}</span>
            </div>
            <Field label="New official price (₹)" required>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <p className="text-xs text-ink-400">
              Changing this price updates it instantly at every MedSure pharmacy.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button loading={busy} onClick={save}>Save price</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------ Medicines ------------------------------ */
function Medicines({ medicines, search, setSearch }) {
  return (
    <Card>
      <CardHeader title="All medicines" subtitle={`${medicines.length} record(s)`} icon="💊"
        action={<SearchInput value={search} onChange={setSearch} placeholder="Search medicines" className="hidden sm:block" />} />
      {medicines.length === 0 ? (
        <EmptyState icon="💊" title="No medicines found" />
      ) : (
        <Table headers={["Medicine", "Manufacturer", "Form", "Submitted", "Official", "Status"]}>
          {medicines.map((m) => (
            <tr key={m.id} className="hover:bg-ink-50/60">
              <td className="td">
                <p className="font-semibold text-ink-900">{m.name} {m.strength}</p>
                <p className="text-xs text-ink-400">{m.generic_name}</p>
              </td>
              <td className="td">{m.manufacturer_org || m.manufacturer_name}</td>
              <td className="td">{m.dosage_form}</td>
              <td className="td">₹{Number(m.submitted_price || 0).toFixed(2)}</td>
              <td className="td">{m.official_price ? `₹${Number(m.official_price).toFixed(2)}` : "—"}</td>
              <td className="td"><StatusBadge status={m.status} /></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* --------------------------------- Users ------------------------------- */
function Users({ users }) {
  const [role, setRole] = useState("manufacturer");
  const [search, setSearch] = useState("");
  const filtered = users
    .filter((u) => u.role === role)
    .filter((u) => (u.name + u.email + (u.org_name || "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader title="Platform users" subtitle={`${filtered.length} ${role}(s)`} icon="👥"
        action={<SearchInput value={search} onChange={setSearch} placeholder="Search users" className="hidden sm:block" />} />
      <div className="flex flex-wrap gap-2 border-b border-ink-100 px-5 py-3">
        {ROLE_TABS.map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={["rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
              role === r ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"].join(" ")}>
            {r} ({users.filter((u) => u.role === r).length})
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="👥" title={`No ${role}s`} />
      ) : (
        <Table headers={["Name", "Email", "Organisation", "Phone", "License", "Joined"]}>
          {filtered.map((u) => (
            <tr key={u.id} className="hover:bg-ink-50/60">
              <td className="td font-semibold text-ink-900">{u.name}</td>
              <td className="td">{u.email}</td>
              <td className="td">{u.org_name || "—"}</td>
              <td className="td">{u.phone || "—"}</td>
              <td className="td font-mono text-xs">{u.license_no || "—"}</td>
              <td className="td text-xs text-ink-400">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* ------------------------------ Shipments ------------------------------ */
function Shipments({ shipments }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("all");

  const filtered = status === "all" ? shipments : shipments.filter((s) => s.status === status);

  const open = async (s) => {
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
        <CardHeader title="All shipments" subtitle={`${filtered.length} of ${shipments.length}`} icon="🚚"
          action={
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
              {["all", "created", "dispatched", "in_transit", "out_for_delivery", "delivered", "received", "cancelled", "damaged", "rejected"].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          } />
        {filtered.length === 0 ? (
          <EmptyState icon="🚚" title="No shipments" message="No shipments match this filter." />
        ) : (
          <Table headers={["Shipment", "Medicine", "From → To", "Qty", "Batch", "Status", ""]}>
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{s.shipment_code}</td>
                <td className="td font-semibold">{s.medicine_name} {s.strength}</td>
                <td className="td">
                  <span className="text-xs">
                    <span className="font-semibold text-ink-700 capitalize">{s.from_role}</span>
                    <span className="text-ink-400"> → </span>
                    <span className="font-semibold text-ink-700 capitalize">{s.to_role}</span>
                  </span>
                  <p className="text-[11px] text-ink-400">{(s.from_org || s.from_name)} → {(s.to_org || s.to_name)}</p>
                </td>
                <td className="td">{s.quantity}</td>
                <td className="td font-mono text-xs">{s.batch_no}</td>
                <td className="td"><StatusBadge status={s.status} /></td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => open(s)}>Track</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

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
              <Info label="Manufacturer" value={detail.shipment.from_role === "manufacturer" ? detail.shipment.from_org || detail.shipment.from_name : "—"} />
              <Info label="Dispatched" value={detail.shipment.dispatched_at ? new Date(detail.shipment.dispatched_at).toLocaleString() : "—"} />
              <Info label="Received" value={detail.shipment.received_at ? new Date(detail.shipment.received_at).toLocaleString() : "—"} />
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

/* ---------------------------- Traceability ----------------------------- */
function Traceability({ ledger, reload }) {
  const toast = useToast();
  const [lookup, setLookup] = useState(null);

  const onScan = async (code) => {
    try {
      const data = await api.get(`/trace/${encodeURIComponent(code)}`);
      setLookup({ code, ...data });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ledger blocks" value={ledger.ledger.length} icon="🔗" />
        <StatCard label="Chain integrity" value={ledger.intact ? "Intact" : "Broken"} icon={ledger.intact ? "✅" : "⛔"}
          tone={ledger.intact ? "brand" : "danger"} />
        <StatCard label="Hashing" value="SHA-256" icon="🔐" tone="ink" />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink-900">Trace a batch</h3>
        <p className="mb-3 text-xs text-ink-500">Enter a QR id to see its full hash-chained history.</p>
        <ScanInput onScan={onScan} buttonLabel="Trace" />
      </Card>

      {lookup && (
        <Card className="animate-fade-up">
          <CardHeader title={`Trace · ${lookup.code}`} icon="🔗"
            action={<ChainStatus complete={lookup.chain.complete} />} />
          <div className="space-y-4 p-5">
            <ChainStages stages={lookup.chain} />
            <TraceTimeline events={lookup.events} showHashes />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Recent ledger blocks" subtitle="Newest first" icon="📚"
          action={<Button variant="outline" className="btn-sm" onClick={reload}>Refresh</Button>} />
        {ledger.ledger.length === 0 ? (
          <EmptyState icon="📚" title="Ledger is empty" message="Traceability blocks appear as medicines move." />
        ) : (
          <Table headers={["#", "Event", "QR / Medicine", "Actor", "Prev hash", "Hash", "When"]}>
            {ledger.ledger.map((b) => (
              <tr key={b.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{b.id}</td>
                <td className="td"><Badge status="info">{String(b.event).replace(/_/g, " ")}</Badge></td>
                <td className="td">
                  <p className="font-mono text-[11px] text-ink-700">{b.qr_id || "—"}</p>
                  <p className="text-xs text-ink-400">{b.medicine_name || ""}</p>
                </td>
                <td className="td text-xs">
                  <span className="font-semibold capitalize text-ink-700">{b.actor_role}</span>
                  <p className="text-ink-400">{b.actor_name}</p>
                </td>
                <td className="td font-mono text-[10px] text-ink-400">{String(b.previous_hash || "").slice(0, 10)}…</td>
                <td className="td font-mono text-[10px] text-brand-700">{String(b.hash || "").slice(0, 10)}…</td>
                <td className="td text-xs text-ink-400">{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------- Flags -------------------------------- */
function Flags({ flags }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);

  const inspect = async (f) => {
    try {
      const data = await api.get(`/trace/${encodeURIComponent(f.qr_id)}`);
      setDetail({ flag: f, ...data });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Card className="border-red-200">
        <CardHeader title="Flagged batches" subtitle={`${flags.length} with incomplete traceability`} icon="⚠️" />
        {flags.length === 0 ? (
          <EmptyState icon="✅" title="Nothing flagged" message="Every batch has a complete Manufacturer → Distributor → Pharmacist chain." />
        ) : (
          <Table headers={["QR ID", "Medicine", "Batch", "Holder", "Chain", ""]}>
            {flags.map((f) => (
              <tr key={f.id} className="hover:bg-red-50/50">
                <td className="td font-mono text-xs">{f.qr_id}</td>
                <td className="td font-semibold">{f.medicine_name} {f.strength}</td>
                <td className="td font-mono text-xs">{f.batch_no}</td>
                <td className="td">
                  <p className="text-sm capitalize">{f.holder_role || "—"}</p>
                  <p className="text-xs text-ink-400">{f.holder_name}</p>
                </td>
                <td className="td">
                  <div className="flex gap-1 text-xs">
                    <span className={f.chain.manufacturer ? "text-brand-600" : "text-ink-300"}>🏭</span>
                    <span className={f.chain.distributor ? "text-brand-600" : "text-ink-300"}>🚚</span>
                    <span className={f.chain.pharmacist ? "text-brand-600" : "text-ink-300"}>⚕️</span>
                  </div>
                </td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => inspect(f)}>Investigate</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Flagged batch investigation" size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">⚠ Incomplete traceability chain</p>
              <p className="mt-1 text-xs text-red-700">
                This batch has not completed every supply-chain stage. Investigate before allowing further movement.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="QR ID" value={detail.flag.qr_id} mono />
              <Info label="Medicine" value={`${detail.flag.medicine_name} ${detail.flag.strength}`} />
              <Info label="Batch" value={detail.flag.batch_no} mono />
              <Info label="Holder" value={`${detail.flag.holder_role || "—"} · ${detail.flag.holder_name || ""}`} />
              <Info label="Remaining" value={`${detail.flag.remaining_qty} / ${detail.flag.quantity} units`} />
              <Info label="State" value={<StatusBadge status={detail.flag.state} />} />
            </div>
            <div>
              <p className="label">Chain</p>
              <ChainStages stages={detail.chain} />
            </div>
            <div>
              <p className="label">Ledger history</p>
              <TraceTimeline events={detail.events} showHashes />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------ Complaints ----------------------------- */
function Complaints({ complaints, reload }) {
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = filter === "all" ? complaints : complaints.filter((c) => c.status === filter);

  const open = (c) => {
    setDetail(c);
    setStatus(c.status);
    setNote(c.admin_note || "");
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/complaints/${detail.id}`, { status, admin_note: note || undefined });
      toast.success("Complaint updated");
      setDetail(null);
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
        <CardHeader title="Customer complaints" subtitle={`${filtered.length} shown`} icon="📣"
          action={
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44">
              {["all", "pending", "under_review", "resolved", "rejected"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          } />
        {filtered.length === 0 ? (
          <EmptyState icon="📣" title="No complaints" message="No complaints match this filter." />
        ) : (
          <Table headers={["Code", "Customer", "Category", "Medicine", "Status", "Raised", ""]}>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{c.complaint_code}</td>
                <td className="td">{c.customer_name}</td>
                <td className="td capitalize">{String(c.category).replace(/_/g, " ")}</td>
                <td className="td">{c.medicine_name || "—"}</td>
                <td className="td"><StatusBadge status={c.status} /></td>
                <td className="td text-xs text-ink-400">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => open(c)}>Handle</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Handle complaint" size="md"
        subtitle={detail ? detail.complaint_code : ""}>
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Customer" value={detail.customer_name} />
              <Info label="Category" value={String(detail.category).replace(/_/g, " ")} />
              <Info label="Medicine" value={detail.medicine_name || "—"} />
              <Info label="Pharmacist" value={detail.pharmacist_org || detail.pharmacist_name || "—"} />
              <Info label="Bill" value={detail.bill_no || "—"} mono />
              <Info label="Raised" value={new Date(detail.created_at).toLocaleString()} />
            </div>
            <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">{detail.description}</div>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {["pending", "under_review", "resolved", "rejected"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </Select>
            </Field>
            <Field label="Response to customer">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the resolution or decision" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
              <Button loading={busy} onClick={save}>Save response</Button>
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
