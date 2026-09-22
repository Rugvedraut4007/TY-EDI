import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { ScanInput } from "../components/QRPanel";
import { Badge, Card, LoadingBlock } from "../components/UI";
import { ChainStages } from "../components/TraceTimeline";
import Logo from "../components/Logo";

export default function VerifyMedicine() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (code) => {
    if (!code) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.get(`/verify/${encodeURIComponent(code)}`, { auth: false });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const qr = params.get("qr");
  useEffect(() => {
    if (qr) run(qr);
  }, [qr, run]);

  const handleScan = (code) => {
    setParams({ qr: code });
    run(code);
  };

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
          <h1 className="text-2xl font-bold text-ink-900">Verify a medicine</h1>
          <p className="mt-1 text-sm text-ink-500">
            Scan the QR code on the medicine package, or type the QR ID printed on it.
          </p>
        </div>

        <Card className="p-5">
          <ScanInput onScan={handleScan} placeholder="MED-PCM20260901-002" buttonLabel="Verify" />
          <p className="mt-3 text-xs text-ink-400">
            Try the demo code <button className="link" onClick={() => handleScan("MED-PCM20260901-002")}>MED-PCM20260901-002</button>
          </p>
        </Card>

        {loading && <Card><LoadingBlock label="Checking the traceability ledger..." /></Card>}

        {error && !loading && (
          <Card className="border-red-200 bg-red-50 p-6 text-center">
            <div className="text-3xl">⚠️</div>
            <h3 className="mt-2 text-lg font-bold text-red-800">Not verified</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </Card>
        )}

        {result && !loading && (
          <div className="space-y-5 animate-fade-up">
            {result.verified ? (
              <>
                <Card className="overflow-hidden">
                  <div className={result.complete ? "bg-brand-50 px-5 py-4" : "bg-amber-50 px-5 py-4"}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl">
                          {result.complete ? "✅" : "⚠️"}
                        </span>
                        <div>
                          <p className="text-base font-bold text-ink-900">
                            {result.complete ? "Supply chain verified" : "Verification incomplete"}
                          </p>
                          <p className="text-xs text-ink-600">
                            {result.complete
                              ? "This package passed through every required stage."
                              : "One or more supply-chain stages are missing for this batch."}
                          </p>
                        </div>
                      </div>
                      <Badge status={result.complete ? "approved" : "flagged"}>
                        {result.complete ? "Complete" : "Flagged for admin"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-5 p-5">
                    <div>
                      <h2 className="text-lg font-bold text-ink-900">{result.medicine.medicine_name}</h2>
                      <p className="text-sm text-ink-500">
                        {result.medicine.generic_name} · {result.medicine.strength} · {result.medicine.dosage_form}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info label="Official price" value={`₹${Number(result.medicine.official_price).toFixed(2)}`} highlight />
                      <Info label="Batch number" value={result.medicine.batch_no} />
                      <Info label="QR ID" value={result.medicine.qr_id} mono />
                      <Info label="Expiry" value={result.medicine.expiry_date ? new Date(result.medicine.expiry_date).toLocaleDateString() : "—"} />
                      <Info label="Manufacturer" value={result.medicine.manufacturer_org || result.medicine.manufacturer_name} />
                      <Info label="Available" value={`${result.medicine.remaining_qty} units`} />
                    </div>

                    <div>
                      <p className="label">Supply chain</p>
                      <ChainStages stages={result.stages} />
                    </div>

                    {result.parties?.length > 0 && (
                      <div>
                        <p className="label">Handled by</p>
                        <div className="flex flex-wrap gap-2">
                          {result.parties.map((p) => (
                            <span key={p.actor_role + p.actor_name} className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs">
                              <span className="font-semibold capitalize text-ink-700">{p.actor_role}</span>
                              <span className="text-ink-500"> · {p.actor_name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.medicine.description && (
                      <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{result.medicine.description}</p>
                    )}
                  </div>
                </Card>

                {!result.complete && (
                  <Card className="border-red-200 bg-red-50 p-5">
                    <p className="text-sm font-semibold text-red-800">⚠ This batch has been flagged</p>
                    <p className="mt-1 text-sm text-red-700">
                      MedSure detected that the full Manufacturer → Distributor → Pharmacist chain is not complete
                      for this batch. It has been flagged for administrator review.
                    </p>
                  </Card>
                )}
              </>
            ) : (
              <Card className="border-red-200 bg-red-50 p-6 text-center">
                <div className="text-3xl">🚫</div>
                <h3 className="mt-2 text-lg font-bold text-red-800">Not verified</h3>
                <p className="mt-1 text-sm text-red-700">{result.message}</p>
              </Card>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <Link to="/" className="btn-outline">← Back to MedSure</Link>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value, mono, highlight }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={[
        "mt-0.5 text-sm font-semibold",
        mono ? "font-mono text-xs" : "",
        highlight ? "text-brand-700 text-base" : "text-ink-800",
      ].join(" ")}>{value || "—"}</p>
    </div>
  );
}
