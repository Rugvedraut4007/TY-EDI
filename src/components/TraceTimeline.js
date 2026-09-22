import { Badge, cx } from "./UI";

const EVENT_META = {
  DISPATCHED: { icon: "🚚", tone: "bg-blue-50 text-blue-700" },
  RECEIVED: { icon: "📥", tone: "bg-brand-50 text-brand-700" },
  SPLIT: { icon: "✂️", tone: "bg-purple-50 text-purple-700" },
  BILLED: { icon: "🧾", tone: "bg-amber-50 text-amber-700" },
  MEDICINE_APPROVED: { icon: "✅", tone: "bg-brand-50 text-brand-700" },
  MEDICINE_REJECTED: { icon: "⛔", tone: "bg-red-50 text-red-700" },
  PRICE_UPDATED: { icon: "💰", tone: "bg-amber-50 text-amber-700" },
};

function metaFor(event) {
  if (EVENT_META[event]) return EVENT_META[event];
  if (event?.startsWith("SHIPMENT_")) return { icon: "📦", tone: "bg-ink-100 text-ink-600" };
  return { icon: "•", tone: "bg-ink-100 text-ink-600" };
}

export function ChainStages({ stages }) {
  if (!stages) return null;
  const items = [
    { key: "manufacturer", label: "Manufacturer", icon: "🏭" },
    { key: "distributor", label: "Distributor", icon: "🚚" },
    { key: "pharmacist", label: "Pharmacist", icon: "⚕️" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item, i) => (
        <div key={item.key} className="flex items-center gap-2">
          <div
            className={cx(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
              stages[item.key] ? "border-brand-200 bg-brand-50 text-brand-700" : "border-ink-200 bg-ink-50 text-ink-400"
            )}
          >
            <span>{stages[item.key] ? "✓" : "✗"}</span>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
          {i < items.length - 1 && <span className="text-ink-300">→</span>}
        </div>
      ))}
    </div>
  );
}

export function ChainStatus({ complete }) {
  return complete ? (
    <Badge status="approved">✓ Complete traceability</Badge>
  ) : (
    <Badge status="flagged">⚠ Incomplete traceability</Badge>
  );
}

export default function TraceTimeline({ events = [], showHashes = false }) {
  if (!events.length) {
    return <p className="px-1 py-6 text-center text-sm text-ink-400">No traceability records yet.</p>;
  }

  return (
    <ol className="relative space-y-4 pl-8">
      <span className="absolute left-[13px] top-2 bottom-2 w-px bg-ink-200" />
      {events.map((e, i) => {
        const meta = metaFor(e.event);
        return (
          <li key={e.id ?? i} className="relative">
            <span className={cx("absolute -left-8 grid h-7 w-7 place-items-center rounded-full text-xs", meta.tone)}>
              {meta.icon}
            </span>
            <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{String(e.event).replace(/_/g, " ")}</p>
                <span className="text-[11px] text-ink-400">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {e.actor_role && <span className="font-semibold capitalize text-ink-600">{e.actor_role}</span>}
                {e.actor_name ? ` · ${e.actor_name}` : ""}
                {e.location ? ` · ${e.location}` : ""}
              </p>
              {e.details && (
                <p className="mt-1 font-mono text-[11px] text-ink-400">
                  {typeof e.details === "string" ? e.details : JSON.stringify(e.details)}
                </p>
              )}
              {showHashes && e.hash && (
                <p className="mt-1 break-all font-mono text-[10px] text-ink-300">
                  hash {String(e.hash).slice(0, 24)}… ← prev {String(e.previous_hash || "").slice(0, 16)}…
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
