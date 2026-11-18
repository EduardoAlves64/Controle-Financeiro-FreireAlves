"use client";
import { useState } from "react";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBRL, sumMoney } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { TransactionDetails } from "./transaction-details";
import { TransactionRow } from "./transaction-row";

function dayLabel(date: string) {
  const today = todayISO();
  if (date === today) return "Hoje";
  const y = new Date(Date.parse(`${today}T12:00:00`) - 86400000).toISOString().slice(0, 10);
  if (date === y) return "Ontem";
  const s = formatDate(date, "EEEE, dd 'de' MMMM");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function TransactionList({ transactions, grouped = true }: { transactions: Transaction[]; grouped?: boolean }) {
  const [selected, setSelected] = useState<Transaction | null>(null);

  if (!grouped) {
    return (
      <>
        <div className="flex flex-col">
          {transactions.map((t) => (
            <TransactionRow key={t.id} tx={t} onClick={() => setSelected(t)} />
          ))}
        </div>
        <TransactionDetails tx={selected} onClose={() => setSelected(null)} />
      </>
    );
  }

  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = t.status === "pending" && t.due_date ? t.due_date : t.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const keys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <>
      <div className="flex flex-col gap-4">
        {keys.map((k) => {
          const items = groups.get(k)!;
          const net = sumMoney(
            items.map((t) => (t.status !== "paid" ? 0 : t.kind === "income" ? Number(t.amount) : t.kind === "expense" ? -Number(t.amount) : 0)),
          );
          return (
            <section key={k}>
              <div className="sticky top-16 z-10 -mx-2 flex items-center justify-between bg-surface/90 px-4 py-1.5 backdrop-blur md:static md:bg-transparent">
                <h3 className="text-[12px] font-medium text-muted-foreground">{dayLabel(k)}</h3>
                {net !== 0 && <span className="text-[12px] font-medium text-muted-foreground tabular">{formatBRL(net, { signed: true })}</span>}
              </div>
              <div className="flex flex-col">
                {items.map((t) => (
                  <TransactionRow key={t.id} tx={t} onClick={() => setSelected(t)} showDate={false} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <TransactionDetails tx={selected} onClose={() => setSelected(null)} />
    </>
  );
}
