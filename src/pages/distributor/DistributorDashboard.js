import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, LoadingBlock, Modal,
  SearchInput, Select, StatCard, StatusBadge, Table, Textarea,
} from "../../components/UI";
import { QRPanel, ScanInput } from "../../components/QRPanel";
import TraceTimeline, { ChainStages } from "../../components/TraceTimeline";

const NAV = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "incoming", label: "Incoming & Scan", icon: "📥" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "orders", label: "Pharmacist Orders", icon: "🧾" },
  { id: "dispatch", label: "Partial Dispatch", icon: "✂️" },
  { id: "outgoing", label: "Shipment Tracking", icon: "🚚" },
];

export default function DistributorDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sh, inv, o] = await Promise.all([
        api.get("/stats"),
        api.get("/shipments"),
        api.get("/batches"),
        api.get("/orders"),
      ]);
      setStats(s);
      setShipments(sh.shipments);
      setInventory(inv.batches);
      setOrders(o.orders);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const incoming = useMemo(() => shipments.filter((s) => s.to_role === "distributor" && s.status !== "received"), [shipments]);
  const outgoing = useMemo(() => shipments.filter((s) => s.from_role === "distributor"), [shipments]);
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);

  const nav = NAV.map((n) => {
    if (n.id === "incoming") return { ...n, count: incoming.length };
    if (n.id === "orders") return { ...n, count: pendingOrders };
    return n;
  });

  const filteredInv = inventory.filter((b) =>
    (b.medicine_name + b.batch_no + b.qr_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout nav={nav} active={tab} onNavigate={setTab} title={TITLES[tab].title} subtitle={TITLES[tab].subtitle}>
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : (
        <>
          {tab === "overview" && <Overview stats={stats} incoming={incoming} inventory={inventory} orders={orders} onGo={setTab} />}
          {tab === "incoming" && <Incoming shipments={incoming} reload={load} />}
          {tab === "inventory" && (
            <Inventory inventory={filteredInv} search={search} setSearch={setSearch} reload={load} />
          )}
          {tab === "orders" && <Orders orders={orders} inventory={inventory} reload={load} />}
          {tab === "dispatch" && <PartialDispatch inventory={inventory} reload={load} />}
          {tab === "outgoing" && <Outgoing shipments={outgoing} />}
        </>
      )}
    </Layout>
  );
}

const TITLES = {
  overview: { title: "Distributor Dashboard", subtitle: "Receiving, inventory and pharmacy supply" },
  incoming: { title: "Incoming Shipments", subtitle: "Scan the QR code to receive stock" },
  inventory: { title: "Inventory", subtitle: "Batches currently in your warehouse" },
  orders: { title: "Pharmacist Orders", subtitle: "Accept and dispatch pharmacy orders" },
  dispatch: { title: "Partial Dispatch / Package Split", subtitle: "Send part of a box and keep the remainder" },
  outgoing: { title: "Shipment Tracking", subtitle: "Everything you dispatched to pharmacies" },
};

/* ------------------------------- Overview ------------------------------ */
function Overview({ stats, incoming, inventory, orders, onGo }) {
  const expiring = inventory.filter((b) => {
    if (!b.expiry_date) return false;
    const days = (new Date(b.expiry_date) - Date.now()) / 86400000;
    return days < 180;
  });
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Incoming shipments" value={stats?.incoming ?? 0} icon="📥" tone="info" />
        <StatCard label="Inventory batches" value={stats?.inventoryItems ?? 0} icon="📦" />
        <StatCard label="Units in stock" value={stats?.totalUnits ?? 0} icon="🔢" tone="brand" />
        <StatCard label="Pending orders" value={stats?.orders ?? 0} icon="🧾" tone="warn" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Awaiting QR scan" icon="📥"
            action={<Button variant="ghost" className="btn-sm" onClick={() => onGo("incoming")}>Open</Button>} />
          {incoming.length === 0 ? (
            <EmptyState icon="✅" title="All caught up" message="No shipments waiting to be received." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {incoming.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{s.medicine_name} {s.strength}</p>
                    <p className="truncate text-xs text-ink-400">from {s.from_org || s.from_name} · {s.quantity} units</p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Expiry watch" icon="⏳" action={<Badge status="pending">{expiring.length}</Badge>} />
          {expiring.length === 0 ? (
            <EmptyState icon="🕒" title="Nothing expiring soon" message="No batches expiring within 6 months." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {expiring.slice(0, 4).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{b.medicine_name}</p>
                    <p className="truncate text-xs text-ink-400">{b.batch_no} · {b.remaining_qty} left</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-700">
                    {new Date(b.expiry_date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------- Incoming ------------------------------ */
function Incoming({ shipments, reload }) {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const receive = async (shipment, qr) => {
    setBusy(true);
    try {
      await api.post(`/shipments/${shipment.id}/receive`, { qr_id: qr });
      toast.success("Package received and added to inventory");
      setSelected(null);
      setScanResult(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onScan = async (code) => {
    try {
      const data = await api.get(`/batches/scan/${encodeURIComponent(code)}`);
      setScanResult(data);
      const match = shipments.find((s) => s.qr_id === code || s.id === data.batch.shipment_id);
      if (match) setSelected(match);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink-900">Scan &amp; receive</h3>
        <p className="mb-3 text-xs text-ink-500">
          Scan the QR code on the package. Each QR represents a specific medicine batch.
        </p>
        <ScanInput onScan={onScan} buttonLabel="Look up" />
        {scanResult && (
          <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50 p-4">
            <p className="text-sm font-semibold text-ink-800">
              {scanResult.batch.medicine_name} {scanResult.batch.strength} · {scanResult.batch.batch_no}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-500">{scanResult.batch.qr_id}</p>
            <div className="mt-2"><ChainStages stages={scanResult.chain.stages} /></div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Incoming shipments" subtitle={`${shipments.length} pending`} icon="📥" />
        {shipments.length === 0 ? (
          <EmptyState icon="✅" title="Nothing to receive" message="You have received all shipments addressed to you." />
        ) : (
          <Table headers={["Shipment", "Medicine", "From", "Qty", "QR ID", "Status", ""]}>
            {shipments.map((s) => (
              <tr key={s.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{s.shipment_code}</td>
                <td className="td font-semibold">{s.medicine_name} {s.strength}</td>
                <td className="td">{s.from_org || s.from_name}</td>
                <td className="td">{s.quantity}</td>
                <td className="td font-mono text-xs">{s.qr_id}</td>
                <td className="td"><StatusBadge status={s.status} /></td>
                <td className="td text-right">
                  <Button className="btn-sm" onClick={() => setSelected(s)}>Receive</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Receive shipment"
        subtitle={selected ? `${selected.medicine_name} ${selected.strength}` : ""}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Shipment" value={selected.shipment_code} mono />
              <Info label="Quantity" value={`${selected.quantity} units`} />
              <Info label="From" value={selected.from_org || selected.from_name} />
              <Info label="Batch" value={selected.batch_no} mono />
            </div>
            <QRPanel value={selected.qr_id} title="Package QR code" subtitle={selected.qr_id} size={130} />
            <Button className="w-full" loading={busy} onClick={() => receive(selected, selected.qr_id)}>
              Confirm receipt
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ Inventory ------------------------------ */
function Inventory({ inventory, search, setSearch, reload }) {
  return (
    <Card>
      <CardHeader
        title="Warehouse inventory"
        subtitle={`${inventory.length} batch(es)`}
        icon="📦"
        action={<SearchInput value={search} onChange={setSearch} placeholder="Search medicine / batch / QR" className="hidden sm:block" />}
      />
      {inventory.length === 0 ? (
        <EmptyState icon="📦" title="No stock" message="Receive a shipment to populate your inventory." />
      ) : (
        <Table headers={["Medicine", "Batch", "QR ID", "Available", "Original", "Expiry", "State"]}>
          {inventory.map((b) => (
            <tr key={b.id} className="hover:bg-ink-50/60">
              <td className="td">
                <p className="font-semibold text-ink-900">{b.medicine_name} {b.strength}</p>
                <p className="text-xs text-ink-400">{b.manufacturer_org}</p>
              </td>
              <td className="td font-mono text-xs">{b.batch_no}</td>
              <td className="td font-mono text-xs">{b.qr_id}</td>
              <td className="td">
                <span className="font-semibold text-brand-700">{b.remaining_qty}</span>
                {b.parent_qr_id && <p className="text-[10px] text-purple-600">split from parent</p>}
              </td>
              <td className="td">{b.quantity}</td>
              <td className="td">
                {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "—"}
              </td>
              <td className="td"><StatusBadge status={b.state} /></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* -------------------------------- Orders ------------------------------- */
function Orders({ orders, inventory, reload }) {
  const toast = useToast();
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const [form, setForm] = useState({ batch_id: "", quantity: "" });
  const [busy, setBusy] = useState(false);

  const act = async (order, action) => {
    try {
      await api.post(`/orders/${order.id}/${action}`, {});
      toast.success(`Order ${action === "accept" ? "accepted" : "rejected"}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDispatch = (order) => {
    const batches = inventory.filter((b) => b.medicine_id === order.medicine_id && b.remaining_qty > 0);
    const batch = batches[0];
    setDispatchOrder(order);
    setForm({
      batch_id: batch ? String(batch.id) : "",
      quantity: batch ? String(Math.min(order.quantity, batch.remaining_qty)) : "",
    });
  };

  const submitDispatch = async () => {
    if (!selectedBatch) return toast.error("Select a batch to dispatch from");
    if (invalidQty) return toast.error(`Enter a quantity between 1 and ${selectedBatch.remaining_qty}`);
    setBusy(true);
    try {
      await api.post(`/orders/${dispatchOrder.id}/dispatch`, {
        batch_id: Number(form.batch_id),
        quantity: qty,
      });
      toast.success(
        qty < dispatchOrder.quantity
          ? `Dispatched ${qty} of ${dispatchOrder.quantity} units (partial dispatch)`
          : "Order dispatched to pharmacist"
      );
      setDispatchOrder(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rejectForStock = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${dispatchOrder.id}/reject`, { note: "No stock available to fulfil this order" });
      toast.success("Order rejected — no stock available");
      setDispatchOrder(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Only batches of the ordered medicine can fulfil it, so a distributor with no
  // stock for that medicine gets an explanation instead of an empty dropdown.
  const eligibleBatches = dispatchOrder
    ? inventory.filter((b) => b.medicine_id === dispatchOrder.medicine_id && b.remaining_qty > 0)
    : [];
  const selectedBatch = eligibleBatches.find((b) => String(b.id) === String(form.batch_id));
  const qty = Number(form.quantity) || 0;
  const invalidQty = !selectedBatch || qty <= 0 || qty > selectedBatch.remaining_qty;
  const remainingAfter = selectedBatch ? selectedBatch.remaining_qty - qty : 0;

  return (
    <>
      <Card>
        <CardHeader title="Pharmacist orders" subtitle={`${orders.length} order(s)`} icon="🧾" />
        {orders.length === 0 ? (
          <EmptyState icon="🧾" title="No orders yet" message="Pharmacies can place orders for your medicines." />
        ) : (
          <Table headers={["Order", "Pharmacist", "Medicine", "Qty", "Status", "Tracking QR", "Placed", ""]}>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{o.order_code}</td>
                <td className="td">{o.pharmacist_org || o.pharmacist_name}</td>
                <td className="td font-semibold">{o.medicine_name}</td>
                <td className="td">{o.quantity}</td>
                <td className="td"><StatusBadge status={o.status} /></td>
                <td className="td font-mono text-xs">
                  {o.shipment_qr ? o.shipment_qr : <span className="text-ink-300">—</span>}
                </td>
                <td className="td text-xs text-ink-400">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="td">
                  <div className="flex justify-end gap-2">
                    {o.status === "pending" && (
                      <>
                        <Button className="btn-sm" onClick={() => act(o, "accept")}>Accept</Button>
                        <Button variant="ghost" className="btn-sm" onClick={() => act(o, "reject")}>Reject</Button>
                      </>
                    )}
                    {o.status === "accepted" && (
                      <Button className="btn-sm" onClick={() => openDispatch(o)}>Dispatch</Button>
                    )}
                    {o.status === "dispatched" && <Badge status="info">Awaiting receipt</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(dispatchOrder)} onClose={() => setDispatchOrder(null)} title="Dispatch order" size="md"
        subtitle={dispatchOrder ? `${dispatchOrder.medicine_name} · requested ${dispatchOrder.quantity} units` : ""}>
        {dispatchOrder && (
          <div className="space-y-4">
            {eligibleBatches.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  You hold no {dispatchOrder.medicine_name} stock
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Only the ordered medicine can fulfil this order. Receive a shipment from the manufacturer
                  first, or reject the order so the pharmacy can order from another distributor.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="label">
                    Dispatch from batch <span className="text-danger">*</span>
                  </p>
                  <div className="space-y-2">
                    {eligibleBatches.map((b) => {
                      const active = String(b.id) === String(form.batch_id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              batch_id: String(b.id),
                              quantity: String(Math.min(dispatchOrder.quantity, b.remaining_qty)),
                            })
                          }
                          className={[
                            "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                            active
                              ? "border-brand-400 bg-brand-50 ring-1 ring-brand-300"
                              : "border-ink-100 hover:border-brand-200 hover:bg-ink-50",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                              active ? "border-brand-600 bg-brand-600" : "border-ink-300",
                            ].join(" ")}
                          >
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink-800">
                              Batch {b.batch_no}
                              {b.parent_qr_id && (
                                <span className="ml-2 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700">
                                  split package
                                </span>
                              )}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-ink-400">{b.qr_id}</span>
                            <span className="block text-[11px] text-ink-500">
                              {b.remaining_qty} units available
                              {b.expiry_date ? ` · expires ${new Date(b.expiry_date).toLocaleDateString()}` : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field
                  label="Quantity to dispatch"
                  required
                  hint={`Requested ${dispatchOrder.quantity} units — send less for a partial dispatch`}
                  error={invalidQty && selectedBatch ? `Enter 1 – ${selectedBatch.remaining_qty}` : ""}
                >
                  <Input
                    type="number"
                    min="1"
                    max={selectedBatch ? selectedBatch.remaining_qty : undefined}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </Field>

                {selectedBatch && !invalidQty && (
                  <div className="rounded-xl bg-ink-50 p-4 font-mono text-xs leading-relaxed text-ink-600">
                    Package {selectedBatch.batch_no}:{" "}
                    <span className="font-bold text-ink-900">{selectedBatch.remaining_qty} units</span>
                    <br />├── {qty} units → {dispatchOrder.pharmacist_org || dispatchOrder.pharmacist_name}
                    <br />└── {remainingAfter} units → your inventory
                  </div>
                )}

                {selectedBatch && !invalidQty && qty < dispatchOrder.quantity && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    Partial order: the pharmacy asked for {dispatchOrder.quantity} units and you are sending {qty}.
                  </p>
                )}

                <p className="text-xs text-ink-400">
                  A new QR code is issued for the dispatched portion and stays with the package until the
                  pharmacy scans it in.
                </p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDispatchOrder(null)}>Cancel</Button>
              {eligibleBatches.length === 0 ? (
                <Button variant="danger" loading={busy} onClick={rejectForStock}>Reject order</Button>
              ) : (
                <Button loading={busy} disabled={invalidQty} onClick={submitDispatch}>
                  Dispatch{qty > 0 && !invalidQty ? ` ${qty} units` : ""}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* --------------------------- Partial dispatch -------------------------- */
function PartialDispatch({ inventory, reload }) {
  const toast = useToast();
  const [pharmacists, setPharmacists] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/directory?role=pharmacist").then((d) => setPharmacists(d.users)).catch(() => {});
  }, []);

  const batch = inventory.find((b) => String(b.id) === String(batchId));
  const qty = Number(dispatchQty) || 0;
  const remaining = batch ? batch.remaining_qty - qty : 0;
  const invalidQty = batch && (qty <= 0 || qty > batch.remaining_qty);

  const submit = async (e) => {
    e.preventDefault();
    if (!batch || !toId || invalidQty) {
      toast.error("Select a batch, a pharmacist and a valid quantity");
      return;
    }
    setBusy(true);
    try {
      const data = await api.post(`/batches/${batch.id}/split`, {
        dispatch_qty: qty,
        to_id: Number(toId),
        note: note || undefined,
      });
      setResult({ ...data, original_qty: batch.quantity, medicine: batch.medicine_name, batch_no: batch.batch_no, to: pharmacists.find((p) => String(p.id) === String(toId)) });
      toast.success("Partial dispatch recorded");
      setDispatchQty("");
      setNote("");
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Split a package" subtitle="Send part of a box to a pharmacist and keep the rest" icon="✂️" />
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="Batch to dispatch from" required>
            <Select value={batchId} onChange={(e) => { setBatchId(e.target.value); setDispatchQty(""); }}>
              <option value="">Select a batch</option>
              {inventory.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.medicine_name} · {b.batch_no} · {b.remaining_qty} units available
                </option>
              ))}
            </Select>
          </Field>

          {batch && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Original quantity" value={`${batch.quantity} units`} />
              <Info label="Dispatched" value={`${qty} units`} highlight />
              <Info label="Remaining in warehouse" value={`${Math.max(0, remaining)} units`} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Units to dispatch" required error={invalidQty ? `Enter 1 – ${batch?.remaining_qty}` : ""}>
              <Input type="number" min="1" value={dispatchQty} onChange={(e) => setDispatchQty(e.target.value)} placeholder="80" />
            </Field>
            <Field label="Pharmacist" required>
              <Select value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Select a pharmacist</option>
                {pharmacists.map((p) => <option key={p.id} value={p.id}>{p.org_name || p.name}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for this partial dispatch" />
          </Field>

          <Button type="submit" loading={busy} disabled={!batch || !toId || invalidQty}>Record partial dispatch</Button>
        </form>
      </Card>

      <Card className="h-fit p-5">
        <h3 className="text-sm font-semibold text-ink-900">How splitting works</h3>
        <div className="mt-4 space-y-3 text-sm text-ink-600">
          <div className="rounded-xl bg-ink-50 p-4 font-mono text-xs leading-relaxed">
            Original box<br />
            <span className="text-ink-900 font-bold">{result ? result.original_qty : (batch?.quantity ?? 100)} units</span>
            <br />├── {result ? result.child_batch.quantity : qty || "—"} units → Pharmacist<br />
            └── {result ? result.remaining : (batch ? Math.max(0, remaining) : "—")} units → Your inventory
          </div>
          <p className="text-xs text-ink-500">
            MedSure keeps the original QR on the parent package and issues a new QR for the dispatched portion, so
            both parts stay traceable.
          </p>
          {result && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-xs font-semibold text-brand-800">New QR issued</p>
              <p className="mt-1 break-all font-mono text-xs text-brand-700">{result.child_batch.qr_id}</p>
              <p className="mt-2 text-xs text-ink-600">Sent to {result.to?.org_name || result.to?.name}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Outgoing ------------------------------- */
function Outgoing({ shipments }) {
  const [detail, setDetail] = useState(null);
  const toast = useToast();

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
        <CardHeader title="Outgoing shipments" subtitle={`${shipments.length} shipment(s)`} icon="🚚" />
        {shipments.length === 0 ? (
          <EmptyState icon="🚚" title="No dispatches yet" message="Use Partial Dispatch to send stock to a pharmacy." />
        ) : (
          <Table headers={["Shipment", "Medicine", "To pharmacist", "Qty", "Batch", "QR ID", "Status", ""]}>
            {shipments.map((s) => (
              <tr key={s.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{s.shipment_code}</td>
                <td className="td font-semibold">{s.medicine_name}</td>
                <td className="td">{s.to_org || s.to_name}</td>
                <td className="td">{s.quantity}</td>
                <td className="td font-mono text-xs">{s.batch_no}</td>
                <td className="td font-mono text-xs">{s.qr_id || "—"}</td>
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
              <Info label="Medicine" value={detail.shipment.medicine_name} />
              <Info label="Quantity" value={`${detail.shipment.quantity} units`} />
              <Info label="To" value={detail.shipment.to_org || detail.shipment.to_name} />
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

function Info({ label, value, mono, highlight }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={["mt-0.5 text-sm font-semibold", mono ? "font-mono text-xs" : "", highlight ? "text-brand-700" : "text-ink-800"].join(" ")}>
        {value || "—"}
      </p>
    </div>
  );
}
