"use client";
import { formatBRL } from "@/lib/money";

interface Item {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  payload?: Record<string, unknown>;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  labelFormatter?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-border bg-surface/95 px-3 py-2.5 shadow-elevated backdrop-blur">
      {label !== undefined && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[12.5px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: (p.payload?.color as string) ?? p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular">{formatBRL(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const axisTick = { fill: "var(--muted-foreground)", fontSize: 11.5 };
