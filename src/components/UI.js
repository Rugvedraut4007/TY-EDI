import { useEffect } from "react";
import { createPortal } from "react-dom";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------- Spinner ------------------------------- */
export function Spinner({ className = "h-4 w-4" }) {
  return (
    <span
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      style={{ borderTopColor: "transparent" }}
    />
  );
}

export function LoadingBlock({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-500">
      <Spinner className="h-5 w-5 text-brand-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/* -------------------------------- Button ------------------------------- */
export function Button({ variant = "primary", className, loading, children, ...rest }) {
  const variants = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    outline: "btn-outline",
    danger: "btn-danger",
    subtle: "btn bg-brand-50 text-brand-700 hover:bg-brand-100",
  };
  return (
    <button className={cx(variants[variant], className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/* --------------------------------- Card -------------------------------- */
export function Card({ className, children, ...rest }) {
  return (
    <div className={cx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div className="flex items-center gap-3">
        {icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-lg">{icon}</span>}
        <div>
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Badge -------------------------------- */
const STATUS_TONES = {
  approved: "bg-brand-50 text-brand-700",
  received: "bg-brand-50 text-brand-700",
  resolved: "bg-brand-50 text-brand-700",
  completed: "bg-brand-50 text-brand-700",
  delivered: "bg-brand-50 text-brand-700",
  pending: "bg-warn/10 text-amber-700",
  in_transit: "bg-info/10 text-blue-700",
  dispatched: "bg-info/10 text-blue-700",
  out_for_delivery: "bg-info/10 text-blue-700",
  accepted: "bg-info/10 text-blue-700",
  under_review: "bg-info/10 text-blue-700",
  created: "bg-ink-100 text-ink-600",
  rejected: "bg-danger/10 text-red-700",
  cancelled: "bg-danger/10 text-red-700",
  damaged: "bg-danger/10 text-red-700",
  sold_out: "bg-ink-100 text-ink-600",
  split: "bg-purple-50 text-purple-700",
  in_stock: "bg-brand-50 text-brand-700",
  flagged: "bg-danger/10 text-red-700",
};

export function statusTone(status) {
  return STATUS_TONES[String(status || "").toLowerCase()] || "bg-ink-100 text-ink-600";
}

export function Badge({ children, status, className }) {
  return <span className={cx("badge", status ? statusTone(status) : "bg-ink-100 text-ink-600", className)}>{children}</span>;
}

export function StatusBadge({ status }) {
  const label = String(status || "").replace(/_/g, " ");
  return <Badge status={status}>{label}</Badge>;
}

/* -------------------------------- Inputs ------------------------------- */
export function Field({ label, error, hint, children, required }) {
  return (
    <label className="block">
      {label && (
        <span className="label">
          {label} {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Input({ className, ...rest }) {
  return <input className={cx("input", className)} {...rest} />;
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx("input min-h-[96px] resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cx("input cursor-pointer", className)} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search...", className }) {
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">🔍</span>
      <input
        className="input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/* -------------------------------- Modal -------------------------------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" };

  // Rendered through a portal on <body>: ancestors like <main> keep a `transform`
  // from their entry animation, which would otherwise become the containing block
  // for position:fixed and push the dialog off-centre.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop — clicking the page behind the dialog closes it */}
      <div
        className="fixed inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centring wrapper — grows with tall dialogs so they stay scrollable.
          pointer-events-none lets clicks outside the panel fall through to the backdrop. */}
      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4">
        <div
          className={cx(
            "pointer-events-auto relative w-full animate-fade-up rounded-2xl bg-white shadow-pop",
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
              {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700">
              ✕
            </button>
          </div>
          <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, title = "Please confirm", message, confirmLabel = "Confirm", onConfirm, onCancel, danger }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm text-ink-600">{message}</p>
    </Modal>
  );
}

/* ------------------------------ Empty state ---------------------------- */
export function EmptyState({ icon = "📭", title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-2xl">{icon}</div>
      <h4 className="text-base font-semibold text-ink-800">{title}</h4>
      {message && <p className="max-w-sm text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ------------------------------- Stat card ----------------------------- */
export function StatCard({ label, value, icon, tone = "brand", hint }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    info: "bg-info/10 text-blue-700",
    warn: "bg-warn/10 text-amber-700",
    danger: "bg-danger/10 text-red-700",
    ink: "bg-ink-100 text-ink-700",
  };
  return (
    <Card className="animate-fade-up p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        {icon && <span className={cx("grid h-11 w-11 place-items-center rounded-2xl text-xl", tones[tone])}>{icon}</span>}
      </div>
    </Card>
  );
}

/* --------------------------------- Tabs -------------------------------- */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cx(
            "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all",
            active === tab.id ? "bg-white text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-800"
          )}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
          {tab.count != null && (
            <span className={cx("rounded-full px-1.5 py-0.5 text-[10px]", active === tab.id ? "bg-brand-50 text-brand-700" : "bg-white text-ink-500")}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Table -------------------------------- */
export function Table({ headers, children, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="border-b border-ink-100 bg-ink-50/60">
          <tr>
            {headers.map((h) => (
              <th key={h} className="th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {children}
          {empty}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Progress tracker -------------------------- */
export function ProgressSteps({ steps, current }) {
  const index = Math.max(0, steps.indexOf(current));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <span
            className={cx(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
              i < index ? "bg-brand-100 text-brand-700" : i === index ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"
            )}
          >
            {step.replace(/_/g, " ")}
          </span>
          {i < steps.length - 1 && <span className={cx("h-px w-3", i < index ? "bg-brand-400" : "bg-ink-200")} />}
        </div>
      ))}
    </div>
  );
}
