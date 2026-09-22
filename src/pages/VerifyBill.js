import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Button, Card, Input, LoadingBlock, Table } from "../components/UI";
import Logo from "../components/Logo";

export default function VerifyBill() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState("");

  const run = useCallback(async (billNo, hash) => {
    if (!billNo) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.get(`/verify/bill/${encodeURIComponent(billNo)}${hash ? `?h=${encodeURIComponent(hash)}` : ""}`, { auth: false });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const bill = params.get("bill");
  const hash = params.get("h");
  useEffect(() => {
    if (bill) run(bill, hash);
  }, [bill, hash, run]);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-10 w-10" />
            <span className="text-lg font-bold text-ink-900">MedSure</span>
          </Link>
          <Link to="/login" className="btn-outline btn-sm">Login</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink-900">Verify a pharmacy bill</h1>
          <p className="mt-1 text-sm text-ink-500">Enter the bill number to confirm it was issued by MedSure.</p>
        </div>

        <Card className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="BILL-DEMO-0001" value={manual} onChange={(e) => setManual(e.target.value)} />
            <Button onClick={() => { setParams({ bill: manual }); run(manual); }}>Verify</Button>
          </div>
        </Card>

        {loading && <Card><LoadingBlock label="Verifying the bill..." /></Card>}

        {error && !loading && (
          <Card className="border-red-200 bg-red-50 p-6 text-center">
            <div className="text-3xl">⚠️</div>
            <h3 className="mt-2 text-lg font-bold text-red-800">Bill not found</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </Card>
        )}

        {result && !loading && (
          <Card className="animate-fade-up overflow-hidden">
            <div className={result.valid ? "bg-brand-50 px-5 py-4" : "bg-red-50 px-5 py-4"}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl">{result.valid ? "✅" : "⚠️"}</span>
                <div>
                  <p className="text-base font-bold text-ink-900">
                    {result.valid ? "Digitally verified bill" : "Verification failed"}
                  </p>
                  <p className="text-xs text-ink-600">
                    {result.valid
                      ? "The stored digital signature matches this bill's contents."
                      : "The digital signature does not match the bill contents."}
                  </p>
                </div>
                <Badge status={result.valid ? "approved" : "rejected"} className="ml-auto">
                  {result.valid ? "Valid" : "Invalid"}
                </Badge>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Bill number" value={result.bill.bill_no} mono />
                <Info label="Date & time" value={new Date(result.bill.created_at).toLocaleString()} />
                <Info label="Pharmacy" value={result.bill.pharmacist_org || result.bill.pharmacist_name} />
                <Info label="Pharmacist" value={result.bill.pharmacist_name} />
                <Info label="Customer" value={result.bill.customer_name} />
                <Info label="Payment method" value={result.bill.payment_method} />
              </div>

              <Table headers={["Medicine", "Batch", "Qty", "Unit price", "Total"]}>
                {result.items.map((it) => (
                  <tr key={it.id}>
                    <td className="td font-semibold">{it.medicine_name}</td>
                    <td className="td font-mono text-xs">{it.batch_no || "—"}</td>
                    <td className="td">{it.quantity}</td>
                    <td className="td">₹{Number(it.unit_price).toFixed(2)}</td>
                    <td className="td font-semibold">₹{Number(it.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </Table>

              <div className="flex items-center justify-between rounded-xl bg-ink-900 px-5 py-4">
                <span className="text-sm font-semibold text-white/70">Total amount</span>
                <span className="text-2xl font-bold text-white">₹{Number(result.bill.total_amount).toFixed(2)}</span>
              </div>

              <p className="break-all rounded-xl bg-ink-50 px-4 py-3 font-mono text-[11px] text-ink-500">
                verification hash: {result.bill.verification_hash}
              </p>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function Info({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={["mt-0.5 text-sm font-semibold text-ink-800", mono ? "font-mono text-xs" : ""].join(" ")}>{value || "—"}</p>
    </div>
  );
}
