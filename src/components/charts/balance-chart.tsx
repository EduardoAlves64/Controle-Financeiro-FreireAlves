"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactBRL } from "@/lib/money";
import { formatMonth, formatShortMonth } from "@/lib/dates";
import { axisTick, ChartTooltip } from "./chart-tooltip";

export function BalanceChart({ data }: { data: { month: string; balance: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(m) => formatShortMonth(`${m}-01`)} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => formatCompactBRL(v)} width={70} domain={["auto", "auto"]} />
          <Tooltip content={<ChartTooltip labelFormatter={(m) => `Fim de ${formatMonth(`${m}-01`).toLowerCase()}`} />} />
          <Area type="monotone" dataKey="balance" name="Saldo" stroke="var(--primary)" strokeWidth={2.5} fill="url(#balanceFill)" dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--surface)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
