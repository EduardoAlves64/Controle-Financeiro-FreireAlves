"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactBRL } from "@/lib/money";
import { formatMonth, formatShortMonth } from "@/lib/dates";
import { axisTick, ChartTooltip } from "./chart-tooltip";

export function StackedSpendingChart({ data }: { data: { month: string; fixed: number; variable: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -8, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(m) => formatShortMonth(`${m}-01`)} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => formatCompactBRL(v)} width={70} />
          <Tooltip cursor={{ fill: "var(--surface-2)", radius: 8 }} content={<ChartTooltip labelFormatter={(m) => formatMonth(`${m}-01`)} />} />
          <Bar dataKey="fixed" name="Fixas" stackId="a" fill="var(--primary)" maxBarSize={28} />
          <Bar dataKey="variable" name="Variáveis" stackId="a" fill="#E08A2E" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
