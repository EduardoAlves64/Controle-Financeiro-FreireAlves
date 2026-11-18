import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getAppContext } from "@/lib/data/context";
import { getCards } from "@/lib/data/cached";
import {
  byPerspective, getDebtInstallments, getDebts, getInvoices, getRecurring, getRecurringInstances, getTransactions,
} from "@/lib/data/queries";
import { buildObligations } from "@/lib/finance/obligations";
import { isValidISODate, parseISODate, toISODate, todayISO } from "@/lib/dates";

export const metadata = { title: "Calendário" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ data?: string; visao?: string }> }) {
  const sp = await searchParams;
  const date = isValidISODate(sp.data) ? sp.data : todayISO();
  const view = sp.visao === "semana" || sp.visao === "dia" ? sp.visao : "mes";
  const d = parseISODate(date);
  const from = toISODate(addDays(startOfWeek(startOfMonth(d), { weekStartsOn: 1 }), -7));
  const to = toISODate(addDays(endOfWeek(endOfMonth(d), { weekStartsOn: 1 }), 7));

  const ctx = await getAppContext();
  const [txAll, recAll, instances, debtsAll, installments, invoicesAll, cardsAll] = await Promise.all([
    getTransactions(ctx, { from: toISODate(addDays(parseISODate(from), -62)), to }),
    getRecurring(ctx),
    getRecurringInstances(ctx, { from, to }),
    getDebts(ctx),
    getDebtInstallments(ctx),
    getInvoices(ctx),
    getCards(ctx),
  ]);
  const txs = byPerspective(ctx, txAll);
  const recurring = byPerspective(ctx, recAll);
  const debts = byPerspective(ctx, debtsAll);
  const cards = byPerspective(ctx, cardsAll);
  const cardIds = new Set(cards.map((c) => c.id));
  const invoices = invoicesAll.filter((i) => cardIds.has(i.card_id));

  const obligations = buildObligations({
    instances,
    recurring,
    pendingTransactions: txs.filter((t) => t.status === "pending"),
    installments: installments.filter((i) => i.due_date >= from && i.due_date <= to),
    debts,
    invoices: invoices.filter((i) => i.due_date >= from && i.due_date <= to),
    cards,
  });

  const events: CalendarEvent[] = [
    ...obligations.map((o) => ({
      id: o.id,
      date: o.dueDate,
      title: o.title,
      subtitle: o.subtitle,
      amount: o.amount,
      kind: (o.source === "debt" ? "debt" : o.source === "invoice" ? "invoice" : o.direction === "in" ? "bill_income" : "bill") as CalendarEvent["kind"],
      status: o.status,
      href: o.href,
    })),
    ...txs
      .filter((t) => t.status === "paid" && t.date >= from && t.date <= to && (t.kind === "income" || t.kind === "expense") && !t.recurring_instance_id && !t.debt_installment_id)
      .map((t) => ({
        id: `t:${t.id}`,
        date: t.date,
        title: t.description,
        subtitle: t.kind === "income" ? "Receita recebida" : t.credit_card_id ? "Compra no cartão" : "Despesa paga",
        amount: Number(t.amount),
        kind: (t.kind === "income" ? "income" : "expense") as CalendarEvent["kind"],
        status: "paid" as const,
        href: `/movimentacoes?mes=${t.date.slice(0, 7)}&q=${encodeURIComponent(t.description)}`,
      })),
    ...invoices
      .filter((i) => i.closing_date >= from && i.closing_date <= to && Number(i.total) > 0)
      .map((i) => ({
        id: `close:${i.id}`,
        date: i.closing_date,
        title: `Fecha: ${cards.find((c) => c.id === i.card_id)?.name ?? "Cartão"}`,
        subtitle: "Fechamento da fatura",
        amount: null,
        kind: "closing" as const,
        status: "info" as const,
        href: `/cartoes/${i.card_id}`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <PageHeader title="Calendário financeiro" description="Receitas, contas, parcelas, faturas e fechamentos em um só lugar." />
      <CalendarView events={events} date={date} view={view} />
    </div>
  );
}
