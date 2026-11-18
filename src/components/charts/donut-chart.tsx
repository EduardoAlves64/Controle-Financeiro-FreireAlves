"use client";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRL } from "@/lib/money";
import { ChartTooltip } from "./chart-tooltip";

export interface DonutSlice {
  key: string;
  label: string;
  total: number;
  color: string;
  percent: number;
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  max = 6,
  showLegend = true,
}: {
  data: DonutSlice[];
  centerLabel: string;
  centerValue?: number;
  max?: number;
  showLegend?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = data.slice(0, max);
  const rest = data.slice(max);
  const slices = rest.length
    ? [
        ...top,
        {
          key: "rest",
          label: "Outras",
          color: "#A3A9B5",
          total: rest.reduce((a, b) => a + b.total, 0),
          percent: rest.reduce((a, b) => a + b.percent, 0),
        },
      ]
    : top;
  const total = centerValue ?? data.reduce((a, b) => a + b.total, 0);

  return (
    <div className="@container w-full">
    <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center">
      <div className="relative size-48 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices.map((s) => ({ ...s, name: s.label, value: s.total }))}
              dataKey="value"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 2.5 : 0}
              cornerRadius={6}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {slices.map((s, i) => (
                <Cell key={s.key} fill={s.color} opacity={active === null || active === i ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] text-muted-foreground">{active !== null ? slices[active]?.label : centerLabel}</p>
          <p className="text-lg font-semibold tracking-tight tabular">{formatBRL(active !== null ? slices[active]?.total : total)}</p>
          {active !== null && <p className="text-[11px] text-muted-foreground">{slices[active]?.percent.toFixed(0)}%</p>}
        </div>
      </div>
      {showLegend && (
        <ul className="grid w-full grid-cols-1 gap-x-4 gap-y-2 text-[13px]">
          {slices.map((s, i) => (
            <li
              key={s.key}
              className="flex items-center justify-between gap-3"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-[4px]" style={{ background: s.color }} />
                <span className="truncate text-muted-foreground">{s.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="font-medium tabular">{formatBRL(s.total)}</span>
                <span className="w-9 text-right text-[11.5px] text-subtle-foreground tabular">{s.percent.toFixed(0)}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
}
