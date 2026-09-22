import { Card, cx } from "./UI";

export function BarChart({ title, subtitle, data = [], valueKey = "count", labelKey = "label", format }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      <div className="flex h-44 items-end gap-2.5">
        {data.map((d) => {
          const value = Number(d[valueKey]) || 0;
          const height = Math.max(4, (value / max) * 100);
          return (
            <div key={d[labelKey]} className="group flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[11px] font-semibold text-ink-500 opacity-0 transition group-hover:opacity-100">
                {format ? format(value) : value}
              </span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-300 transition-all duration-500 hover:from-brand-600 hover:to-brand-400"
                style={{ height: `${height}%` }}
                title={`${d[labelKey]}: ${format ? format(value) : value}`}
              />
              <span className="text-[10px] font-medium text-ink-400">{d[labelKey]}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const DONUT_COLORS = ["#16b381", "#f5a524", "#e5484d", "#3b82f6"];

export function Donut({ title, subtitle, data = [] }) {
  const total = data.reduce((sum, d) => sum + Number(d.count || 0), 0);
  let acc = 0;
  const stops = data.map((d, i) => {
    const start = total ? (acc / total) * 360 : 0;
    acc += Number(d.count || 0);
    const end = total ? (acc / total) * 360 : 0;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}deg ${end}deg`;
  });

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-6">
        <div
          className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
          style={{ background: total ? `conic-gradient(${stops.join(",")})` : "#eceef2" }}
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
            <div className="text-center">
              <p className="text-xl font-bold text-ink-900">{total}</p>
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Total</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {data.map((d, i) => (
            <div key={d.label} className="flex items-center gap-2 text-sm">
              <span className={cx("h-2.5 w-2.5 rounded-full")} style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="capitalize text-ink-600">{d.label}</span>
              <span className="font-semibold text-ink-900">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
