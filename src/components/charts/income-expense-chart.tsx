"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactBRL } from "@/lib/money";
import { formatShortMonth, formatMonth } from "@/lib/dates";
import { axisTick, ChartTooltip } from "./chart-tooltip";

export function IncomeExpenseChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} barGap={4} margin={{ left: -8, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(m) => formatShortMonth(`${m}-01`)} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => formatCompactBRL(v)} width={70} />
          <Tooltip cursor={{ fill: "var(--surface-2)", radius: 8 }} content={<ChartTooltip labelFormatter={(m) => formatMonth(`${m}-01`)} />} />
          <Bar dataKey="income" name="Receitas" fill="var(--chart-income)" radius={[6, 6, 2, 2]} maxBarSize={22} />
          <Bar dataKey="expense" name="Despesas" fill="var(--chart-expense)" radius={[6, 6, 2, 2]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
