import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, LoadingBlock, Modal,
  SearchInput, Select, StatCard, StatusBadge, Table, Textarea,
} from "../../components/UI";
import { QRPanel, ScanInput } from "../../components/QRPanel";
import { ChainStages } from "../../components/TraceTimeline";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "receive", label: "Receive Stock", icon: "📥" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "orders", label: "Order Stock", icon: "🛒" },
  { id: "billing", label: "Billing (POS)", icon: "🧾" },
  { id: "transactions", label: "Transactions", icon: "📋" },
];

export default function PharmacistDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sh, inv, o, b] = await Promise.all([
        api.get("/stats"), api.get("/shipments"), api.get("/batches"), api.get("/orders"), api.get("/bills"),
      ]);
      setStats(s);
      setShipments(sh.shipments);
      setInventory(inv.batches);
      setOrders(o.orders);
      setBills(b.bills);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const incoming = useMemo(() => shipments.filter((s) => s.to_role === "pharmacist" && s.status !== "received"), [shipments]);
  const nav = NAV.map((n) => (n.id === "receive" ? { ...n, count: incoming.length } : n));

  const filteredInv = inventory.filter((b) =>
    (b.medicine_name + b.batch_no + b.qr_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout nav={nav} active={tab} onNavigate={setTab} title={TITLES[tab].title} subtitle={TITLES[tab].subtitle}>
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : (
        <>
          {tab === "overview" && <Overview stats={stats} inventory={inventory} bills={bills} incoming={incoming} onGo={setTab} />}
          {tab === "receive" && <Receive shipments={incoming} reload={load} />}
          {tab === "inventory" && <Inventory inventory={filteredInv} search={search} setSearch={setSearch} />}
          {tab === "orders" && <Orders orders={orders} inventory={inventory} reload={load} />}
          {tab === "billing" && <Billing inventory={inventory} reload={load} />}
          {tab === "transactions" && <Transactions bills={bills} />}
        </>
      )}
    </Layout>
  );
}

const TITLES = {
  overview: { title: "Pharmacist Dashboard", subtitle: "Inventory, billing and receiving" },
  receive: { title: "Receive Stock", subtitle: "Scan QR codes from distributor deliveries" },
  inventory: { title: "Pharmacy Inventory", subtitle: "Stock held at your pharmacy" },
  orders: { title: "Order Stock", subtitle: "Request medicines from distributors" },
  billing: { title: "Billing", subtitle: "Bill customers at the official MedSure price" },
  transactions: { title: "Transactions", subtitle: "Your issued bills and their verification" },
};

/* ------------------------------- Overview ------------------------------ */
function Overview({ stats, inventory, bills, incoming, onGo }) {
  const lowStock = inventory.filter((b) => b.remaining_qty <= 10);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's revenue" value={`₹${Number(stats?.revenueToday || 0).toFixed(2)}`} icon="💰" tone="brand" />
        <StatCard label="Bills today" value={stats?.billsToday ?? 0} icon="🧾" tone="info" />
        <StatCard label="Stock batches" value={stats?.inventoryItems ?? 0} icon="📦" hint={`${stats?.totalUnits ?? 0} units`} />
        <StatCard label="Incoming" value={incoming.length} icon="📥" tone="warn" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quick actions" icon="⚡" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[
              { id: "billing", icon: "🧾", title: "Create a bill", text: "Start a new customer bill" },
              { id: "receive", icon: "📥", title: "Receive stock", text: `${incoming.length} awaiting scan` },
              { id: "orders", icon: "🛒", title: "Order stock", text: "Request from distributors" },
              { id: "inventory", icon: "📦", title: "View inventory", text: `${inventory.length} batches` },
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
        </Card>

        <Card>
          <CardHeader title="Recent bills" icon="📋"
            action={<Button variant="ghost" className="btn-sm" onClick={() => onGo("transactions")}>View all</Button>} />
          {bills.length === 0 ? (
            <EmptyState icon="🧾" title="No bills yet" message="Create your first customer bill." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {bills.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-ink-800">{b.bill_no}</p>
                    <p className="truncate text-xs text-ink-400">{b.customer_name} · {new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-ink-900">₹{Number(b.total_amount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">{lowStock.length} batch(es) running low</p>
                <p className="text-xs text-amber-700">Consider ordering more stock from your distributor.</p>
              </div>
            </div>
            <Button variant="outline" className="btn-sm" onClick={() => onGo("orders")}>Order stock</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------- Receive ------------------------------ */
function Receive({ shipments, reload }) {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(null);

  const onScan = async (code) => {
    try {
      const data = await api.get(`/batches/scan/${encodeURIComponent(code)}`);
      setScan(data);
      const match = shipments.find((s) => s.qr_id === code);
      if (match) setSelected(match);
      else if (data.batch.holder_id) toast.info("This package is already in someone's inventory");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const receive = async (shipment) => {
    setBusy(true);
    try {
      await api.post(`/shipments/${shipment.id}/receive`, { qr_id: shipment.qr_id });
      toast.success("Stock received and added to inventory");
      setSelected(null);
      setScan(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink-900">Scan &amp; receive</h3>
        <p className="mb-3 text-xs text-ink-500">Scan each package QR code from the distributor's delivery.</p>
        <ScanInput onScan={onScan} buttonLabel="Look up" />
        {scan && (
          <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50 p-4">
            <p className="text-sm font-semibold text-ink-800">
              {scan.batch.medicine_name} {scan.batch.strength} · {scan.batch.batch_no}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-500">{scan.batch.qr_id}</p>
            <div className="mt-2"><ChainStages stages={scan.chain.stages} /></div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Deliveries expected" subtitle={`${shipments.length} pending`} icon="📥" />
        {shipments.length === 0 ? (
          <EmptyState icon="✅" title="No pending deliveries" message="All distributor shipments have been received." />
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

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Receive delivery" size="sm"
        subtitle={selected ? `${selected.medicine_name} · ${selected.quantity} units` : ""}>
        {selected && (
          <div className="space-y-4">
            <div className="space-y-1 rounded-xl bg-ink-50 p-4 text-xs text-ink-600">
              <p>Shipment <span className="font-mono font-semibold text-ink-800">{selected.shipment_code}</span></p>
              <p>Batch <span className="font-mono font-semibold text-ink-800">{selected.batch_no}</span></p>
              <p>From {selected.from_org || selected.from_name}</p>
              {selected.expiry_date && <p>Expires {new Date(selected.expiry_date).toLocaleDateString()}</p>}
            </div>
            <QRPanel value={selected.qr_id} title="Package QR" subtitle={selected.qr_id} size={130} />
            <Button className="w-full" loading={busy} onClick={() => receive(selected)}>Confirm receipt</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ Inventory ------------------------------ */
function Inventory({ inventory, search, setSearch }) {
  return (
    <Card>
      <CardHeader title="Pharmacy inventory" subtitle={`${inventory.length} batch(es)`} icon="📦"
        action={<SearchInput value={search} onChange={setSearch} placeholder="Search medicine / batch" className="hidden sm:block" />} />
      {inventory.length === 0 ? (
        <EmptyState icon="📦" title="No stock" message="Receive a delivery to start selling." />
      ) : (
        <Table headers={["Medicine", "Batch", "QR ID", "Available", "Expiry", "State"]}>
          {inventory.map((b) => (
            <tr key={b.id} className="hover:bg-ink-50/60">
              <td className="td">
                <p className="font-semibold text-ink-900">{b.medicine_name} {b.strength}</p>
                <p className="text-xs text-ink-400">{b.generic_name}</p>
              </td>
              <td className="td font-mono text-xs">{b.batch_no}</td>
              <td className="td font-mono text-xs">{b.qr_id}</td>
              <td className="td">
                <span className="font-semibold text-brand-700">{b.remaining_qty}</span>
                <span className="text-xs text-ink-400"> / {b.quantity}</span>
              </td>
              <td className="td">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "—"}</td>
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
  const [distributors, setDistributors] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ distributor_id: "", medicine_id: "", quantity: "", note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/directory?role=distributor").then((d) => setDistributors(d.users)).catch(() => {});
    api.get("/medicines").then((d) => setMedicines(d.medicines)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.distributor_id || !form.medicine_id || !form.quantity) {
      toast.error("Select a distributor, medicine and quantity");
      return;
    }
    setBusy(true);
    try {
      await api.post("/orders", {
        distributor_id: Number(form.distributor_id),
        medicine_id: Number(form.medicine_id),
        quantity: Number(form.quantity),
        note: form.note || undefined,
      });
      toast.success("Order placed with the distributor");
      setOpen(false);
      setForm({ distributor_id: "", medicine_id: "", quantity: "", note: "" });
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
        <CardHeader title="My orders" subtitle={`${orders.length} order(s)`} icon="🛒"
          action={<Button onClick={() => setOpen(true)}>🛒 New order</Button>} />
        {orders.length === 0 ? (
          <EmptyState icon="🛒" title="No orders yet" message="Order medicines from a distributor to restock." />
        ) : (
          <Table headers={["Order", "Distributor", "Medicine", "Qty", "Status", "Placed"]}>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{o.order_code}</td>
                <td className="td">{o.distributor_org || o.distributor_name}</td>
                <td className="td font-semibold">{o.medicine_name}</td>
                <td className="td">{o.quantity}</td>
                <td className="td"><StatusBadge status={o.status} /></td>
                <td className="td text-xs text-ink-400">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Order stock" subtitle="Request medicines from a distributor">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Distributor" required>
            <Select value={form.distributor_id} onChange={(e) => setForm({ ...form, distributor_id: e.target.value })}>
              <option value="">Select a distributor</option>
              {distributors.map((d) => <option key={d.id} value={d.id}>{d.org_name || d.name}</option>)}
            </Select>
          </Field>
          <Field label="Medicine" required>
            <Select value={form.medicine_id} onChange={(e) => setForm({ ...form, medicine_id: e.target.value })}>
              <option value="">Select a medicine</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>{m.name} {m.strength} · ₹{Number(m.official_price).toFixed(2)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" required>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="100" />
          </Field>
          <Field label="Note">
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Place order</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------- Billing ------------------------------ */
function Billing({ inventory, reload }) {
  const toast = useToast();
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [payment, setPayment] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api.get("/medicines").then((d) => setMedicines(d.medicines)).catch((e) => toast.error(e.message));
  }, [toast]);

  const stockFor = (medicineId) =>
    inventory.filter((b) => b.medicine_id === medicineId).reduce((s, b) => s + b.remaining_qty, 0);

  const results = useMemo(() => {
    if (!search.trim()) return medicines.slice(0, 6);
    return medicines.filter((m) => (m.name + m.generic_name).toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  }, [medicines, search]);

  const add = (m) => {
    const stock = stockFor(m.id);
    if (stock <= 0) return toast.error(`${m.name} is out of stock`);
    setCart((prev) => {
      const existing = prev.find((c) => c.medicine_id === m.id);
      if (existing) {
        if (existing.quantity >= stock) { toast.error(`Only ${stock} units in stock`); return prev; }
        return prev.map((c) => (c.medicine_id === m.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { medicine_id: m.id, name: m.name, strength: m.strength, price: Number(m.official_price), quantity: 1, stock }];
    });
  };

  const setQty = (id, value) => {
    const qty = Math.max(1, Number(value) || 1);
    setCart((prev) => prev.map((c) => (c.medicine_id === id ? { ...c, quantity: Math.min(qty, c.stock) } : c)));
  };

  const remove = (id) => setCart((prev) => prev.filter((c) => c.medicine_id !== id));

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const generate = async () => {
    if (!cart.length) return toast.error("Add at least one medicine");
    setBusy(true);
    try {
      const data = await api.post("/bills", {
        customer_name: customer.name || "Walk-in Customer",
        customer_phone: customer.phone || null,
        payment_method: payment,
        items: cart.map((c) => ({ medicine_id: c.medicine_id, quantity: c.quantity })),
      });
      setReceipt({ bill: data.bill, items: data.items, pharmacist: user });
      setCart([]);
      setCustomer({ name: "", phone: "" });
      toast.success("Bill generated");
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader title="Find medicines" subtitle="Official prices come from the database and cannot be edited" icon="🔍" />
          <div className="p-5">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or generic name..." />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {results.map((m) => {
                const stock = stockFor(m.id);
                return (
                  <button key={m.id} onClick={() => add(m)} disabled={stock <= 0}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-800">{m.name} {m.strength}</span>
                      <span className="block truncate text-xs text-ink-400">{m.generic_name}</span>
                      <span className={["mt-1 block text-[11px] font-semibold", stock > 0 ? "text-brand-600" : "text-red-600"].join(" ")}>
                        {stock > 0 ? `${stock} in stock` : "Out of stock"}
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-bold text-brand-700">₹{Number(m.official_price).toFixed(2)}</span>
                  </button>
                );
              })}
              {results.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-ink-400">No medicines matched.</p>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Bill items" subtitle={`${cart.length} item(s)`} icon="🧾" />
          {cart.length === 0 ? (
            <EmptyState icon="🛒" title="Cart is empty" message="Add medicines from the list above." />
          ) : (
            <Table headers={["Medicine", "Unit price", "Qty", "Line total", ""]}>
              {cart.map((c) => (
                <tr key={c.medicine_id}>
                  <td className="td">
                    <p className="font-semibold text-ink-900">{c.name} {c.strength}</p>
                    <p className="text-[11px] text-ink-400">max {c.stock} units</p>
                  </td>
                  <td className="td">₹{c.price.toFixed(2)}</td>
                  <td className="td">
                    <Input type="number" min="1" max={c.stock} value={c.quantity}
                      onChange={(e) => setQty(c.medicine_id, e.target.value)} className="w-20 py-1.5" />
                  </td>
                  <td className="td font-semibold">₹{(c.price * c.quantity).toFixed(2)}</td>
                  <td className="td text-right">
                    <Button variant="ghost" className="btn-sm" onClick={() => remove(c.medicine_id)}>✕</Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader title="Checkout" icon="💳" />
        <div className="space-y-4 p-5">
          <Field label="Customer name">
            <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Walk-in Customer" />
          </Field>
          <Field label="Customer phone">
            <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="98765 00000" />
          </Field>
          <Field label="Payment method">
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
              {["cash", "card", "upi", "netbanking"].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </Select>
          </Field>

          <div className="rounded-xl bg-ink-50 p-4">
            <div className="flex justify-between text-sm text-ink-600">
              <span>Items</span><span>{cart.reduce((s, c) => s + c.quantity, 0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-ink-200 pt-2">
              <span className="text-sm font-semibold text-ink-700">Total</span>
              <span className="text-2xl font-bold text-brand-700">₹{total.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full py-3" loading={busy} onClick={generate} disabled={!cart.length}>
            Generate bill
          </Button>
          <p className="text-center text-[11px] text-ink-400">
            Prices are fetched from MedSure's official price list and cannot be changed.
          </p>
        </div>
      </Card>

      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Bill generated" size="md">
        {receipt && <ReceiptView receipt={receipt} />}
      </Modal>
    </div>
  );
}

/* ------------------------------ Transactions --------------------------- */
function Transactions({ bills }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);

  const open = async (bill) => {
    try {
      const data = await api.get(`/bills/${bill.id}`);
      setDetail({ bill: data.bill, items: data.items });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="Transactions" subtitle={`${bills.length} bill(s)`} icon="📋" />
        {bills.length === 0 ? (
          <EmptyState icon="🧾" title="No bills yet" message="Generated bills will appear here." />
        ) : (
          <Table headers={["Bill no.", "Customer", "Items total", "Payment", "Date", ""]}>
            {bills.map((b) => (
              <tr key={b.id} className="hover:bg-ink-50/60">
                <td className="td font-mono text-xs">{b.bill_no}</td>
                <td className="td">{b.customer_name}</td>
                <td className="td font-semibold">₹{Number(b.total_amount).toFixed(2)}</td>
                <td className="td"><Badge status="info">{b.payment_method}</Badge></td>
                <td className="td text-xs text-ink-400">{new Date(b.created_at).toLocaleString()}</td>
                <td className="td text-right">
                  <Button variant="outline" className="btn-sm" onClick={() => open(b)}>View bill</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Bill details" size="md">
        {detail && <ReceiptView receipt={{ ...detail, pharmacist: detail.bill }} />}
      </Modal>
    </>
  );
}

/* ------------------------------- Receipt ------------------------------- */
function printReceipt(bill, items) {
  const rows = items
    .map(
      (i) => `<tr><td>${i.medicine_name}</td><td>${i.batch_no || "-"}</td><td>${i.quantity}</td>
      <td>₹${Number(i.unit_price).toFixed(2)}</td><td>₹${Number(i.line_total).toFixed(2)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>${bill.bill_no}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;padding:28px;color:#191d26}
      h1{font-size:20px;margin:0}
      .muted{color:#6b7a8d;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:18px}
      th,td{border-bottom:1px solid #d5dae1;padding:8px;text-align:left;font-size:13px}
      th{background:#f6f7f9;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
      .total{margin-top:18px;display:flex;justify-content:space-between;font-size:18px;font-weight:bold}
      .box{margin-top:18px;border:1px dashed #b3bcc8;padding:12px;font-size:11px;word-break:break-all}
    </style></head><body>
    <h1>${bill.pharmacist_org || "MedSure Pharmacy"}</h1>
    <p class="muted">${bill.pharmacist_name || ""} ${bill.pharmacist_address ? "· " + bill.pharmacist_address : ""}</p>
    <p class="muted">Bill No: <b>${bill.bill_no}</b> · ${new Date(bill.created_at).toLocaleString()}</p>
    <p class="muted">Customer: ${bill.customer_name || "Walk-in"} ${bill.customer_phone ? "· " + bill.customer_phone : ""}</p>
    <table><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="total"><span>Total (${bill.payment_method})</span><span>₹${Number(bill.total_amount).toFixed(2)}</span></div>
    <div class="box"><b>Digital verification hash</b><br/>${bill.verification_hash}<br/><br/>
      Verify at: ${bill.qr_payload || ""}</div>
    <p class="muted" style="margin-top:22px">Prices are official MedSure prices. This is a digital verification, not a government signature.</p>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  const win = window.open("", "_blank", "width=760,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function ReceiptView({ receipt }) {
  const { bill, items } = receipt;
  const pharmacy = bill.pharmacist_org || receipt.pharmacist?.org_name || "MedSure Pharmacy";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-100 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-ink-900">{pharmacy}</p>
            <p className="text-xs text-ink-500">{bill.pharmacist_name || receipt.pharmacist?.name}</p>
          </div>
          <Badge status="approved">Paid · {bill.payment_method}</Badge>
        </div>
        <div className="mt-3 grid gap-1 text-xs text-ink-500">
          <p>Bill no: <span className="font-mono font-semibold text-ink-700">{bill.bill_no}</span></p>
          <p>Date: {new Date(bill.created_at).toLocaleString()}</p>
          <p>Customer: {bill.customer_name}{bill.customer_phone ? ` · ${bill.customer_phone}` : ""}</p>
        </div>

        <div className="mt-4 divide-y divide-ink-100">
          {items.map((i) => (
            <div key={i.id ?? i.medicine_name} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink-700">{i.medicine_name} <span className="text-ink-400">×{i.quantity}</span></span>
              <span className="font-semibold text-ink-800">₹{Number(i.line_total).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-3">
          <span className="text-sm font-semibold text-ink-600">Total</span>
          <span className="text-2xl font-bold text-brand-700">₹{Number(bill.total_amount).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <QRPanel value={bill.qr_payload} size={140} caption="Scan to verify this bill" />
        <p className="break-all text-center font-mono text-[10px] text-ink-400">{bill.verification_hash}</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => printReceipt(bill, items)}>🖨️ Print bill</Button>
      </div>
    </div>
  );
}
