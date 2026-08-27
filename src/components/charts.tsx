"use client";
// Biểu đồ nhẹ, không phụ thuộc thư viện ngoài — dùng token màu của hệ thống.
import { formatNumber } from "@/lib/utils";

export interface BarItem {
  label: string;
  value: number;
  hint?: string;
}

/** Biểu đồ thanh ngang — thích hợp cho xếp hạng (giá trị tồn, doanh thu...). */
export function BarList({
  items,
  unit,
  color = "hsl(var(--primary))",
  empty = "Chưa có dữ liệu",
}: {
  items: BarItem[];
  unit?: string;
  color?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{it.label}</span>
            <span className="font-medium tabular-nums">
              {formatNumber(Math.round(it.value))}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(it.value / max) * 100}%`, background: color }}
            />
          </div>
          {it.hint && <div className="mt-0.5 text-xs text-muted-foreground">{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Biểu đồ vòng (donut) + chú thích — thích hợp cho cơ cấu/tỷ trọng. */
export function Donut({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 flex-none -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * C;
            const dash = `${len} ${C - len}`;
            const el = (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="space-y-1.5">
        {centerLabel && <div className="text-2xl font-bold leading-none">{centerLabel}</div>}
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">{formatNumber(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
