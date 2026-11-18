import { daysUntil, todayISO } from "../dates";
import { subtractMoney, toCents } from "../money";
import type { CreditCard, Debt, DebtInstallment, Invoice, RecurringInstance, RecurringTransaction, Transaction } from "../types";

export type ObligationSource = "recurring" | "transaction" | "debt" | "invoice";
export type ObligationStatus = "paid" | "pending" | "overdue";

/** Um compromisso com data: conta fixa, despesa prevista, parcela de dívida ou fatura. */
export interface Obligation {
  id: string;
  sourceId: string;
  source: ObligationSource;
  direction: "in" | "out";
  title: string;
  subtitle: string;
  amount: number;
  dueDate: string;
  ownerId: string;
  scope: "individual" | "shared";
  status: ObligationStatus;
  daysLeft: number;
  href: string;
  categoryId?: string | null;
}

export function buildObligations(input: {
  instances: RecurringInstance[];
  recurring: RecurringTransaction[];
  pendingTransactions: Transaction[];
  installments: DebtInstallment[];
  debts: Debt[];
  invoices: Invoice[];
  cards: CreditCard[];
  today?: string;
}): Obligation[] {
  const today = input.today ?? todayISO();
  const status = (paid: boolean, due: string): ObligationStatus => (paid ? "paid" : due < today ? "overdue" : "pending");
  const out: Obligation[] = [];

  const recById = new Map(input.recurring.map((r) => [r.id, r]));
  for (const i of input.instances) {
    const r = recById.get(i.recurring_id);
    if (!r || i.status === "skipped") continue;
    out.push({
      id: `rec:${i.id}`,
      sourceId: i.id,
      source: "recurring",
      direction: r.kind === "income" ? "in" : "out",
      title: r.name,
      subtitle: r.kind === "income" ? "Receita prevista" : "Conta fixa",
      amount: Number(i.amount),
      dueDate: i.due_date,
      ownerId: r.owner_id,
      scope: r.scope,
      status: status(i.status === "paid", i.due_date),
      daysLeft: daysUntil(i.due_date, today),
      href: "/contas-fixas",
      categoryId: r.category_id,
    });
  }

  for (const t of input.pendingTransactions) {
    if (t.status !== "pending" || (t.kind !== "expense" && t.kind !== "income")) continue;
    const due = t.due_date ?? t.date;
    out.push({
      id: `tx:${t.id}`,
      sourceId: t.id,
      source: "transaction",
      direction: t.kind === "income" ? "in" : "out",
      title: t.description,
      subtitle: t.kind === "income" ? "Receita prevista" : t.installment_total ? `Parcela ${t.installment_number}/${t.installment_total}` : "Despesa prevista",
      amount: Number(t.amount),
      dueDate: due,
      ownerId: t.owner_id,
      scope: t.scope,
      status: status(false, due),
      daysLeft: daysUntil(due, today),
      href: "/movimentacoes?status=pending",
      categoryId: t.category_id,
    });
  }

  const debtById = new Map(input.debts.map((d) => [d.id, d]));
  for (const i of input.installments) {
    const d = debtById.get(i.debt_id);
    if (!d || d.status === "canceled") continue;
    const remaining = subtractMoney(i.amount, i.paid_amount);
    out.push({
      id: `debt:${i.id}`,
      sourceId: i.id,
      source: "debt",
      direction: "out",
      title: d.name,
      subtitle: `Parcela ${i.number}/${d.installments_count}`,
      amount: i.status === "paid" ? Number(i.amount) : remaining,
      dueDate: i.due_date,
      ownerId: d.owner_id,
      scope: d.scope,
      status: status(i.status === "paid", i.due_date),
      daysLeft: daysUntil(i.due_date, today),
      href: `/dividas/${d.id}`,
    });
  }

  const cardById = new Map(input.cards.map((c) => [c.id, c]));
  for (const inv of input.invoices) {
    const c = cardById.get(inv.card_id);
    if (!c || toCents(inv.total) === 0) continue;
    const paid = inv.status === "paid";
    out.push({
      id: `inv:${inv.id}`,
      sourceId: inv.id,
      source: "invoice",
      direction: "out",
      title: `Fatura ${c.name}`,
      subtitle: inv.status === "open" ? "Fatura aberta (parcial)" : paid ? "Fatura paga" : "Fatura fechada",
      amount: paid ? Number(inv.total) : subtractMoney(inv.total, inv.paid_amount),
      dueDate: inv.due_date,
      ownerId: c.owner_id,
      scope: c.scope,
      status: status(paid, inv.due_date),
      daysLeft: daysUntil(inv.due_date, today),
      href: `/cartoes/${c.id}`,
    });
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
