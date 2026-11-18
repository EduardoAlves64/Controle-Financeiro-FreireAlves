import { inRange, type DateRange } from "../dates";
import { formatBRL, fromCents, toCents, type MoneyLike } from "../money";
import type { Category, Member, Transaction } from "../types";

type Tx = Pick<
  Transaction,
  | "kind"
  | "status"
  | "amount"
  | "date"
  | "category_id"
  | "owner_id"
  | "scope"
  | "account_id"
  | "credit_card_id"
  | "recurring_instance_id"
  | "debt_id"
  | "description"
>;

/** Despesa realizada: tipo expense e paga. Pagamento de fatura NUNCA entra aqui. */
export const isRealizedExpense = (t: Tx) => t.kind === "expense" && t.status === "paid";
export const isRealizedIncome = (t: Tx) => t.kind === "income" && t.status === "paid";
/** Despesa fixa = vinda de conta fixa/recorrente ou parcela de dívida */
export const isFixedExpense = (t: Tx) => !!t.recurring_instance_id || !!t.debt_id;

/** Efeito no saldo das contas (compras no cartão não saem da conta na hora). */
export function accountFlowCents(t: Tx): number {
  if (t.status !== "paid" || !t.account_id) return 0;
  const c = toCents(t.amount);
  switch (t.kind) {
    case "income":
      return c;
    case "expense":
      return -c;
    case "invoice_payment":
      return -c;
    case "adjustment":
      return c;
  }
}

export interface Slice {
  key: string;
  label: string;
  color: string;
  total: number;
  percent: number;
}

export interface PeriodSummary {
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
  count: number;
  pendingExpense: number;
  fixedExpense: number;
  variableExpense: number;
  sharedExpense: number;
  individualExpense: number;
  byCategory: Slice[];
  byPerson: Slice[];
  individualByPerson: Slice[];
  biggestExpense: { description: string; amount: number } | null;
}

const PERSON_COLORS = ["#4969E8", "#E08A2E", "#16A36A", "#7C5CE0"];

function slices(map: Map<string, number>, meta: (key: string) => { label: string; color: string }): Slice[] {
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, cents]) => ({
      key,
      ...meta(key),
      total: fromCents(cents),
      percent: total ? (cents / total) * 100 : 0,
    }));
}

export function summarize(
  txs: Tx[],
  range: DateRange,
  categories: Pick<Category, "id" | "name" | "color">[],
  members: Pick<Member, "user_id" | "full_name">[],
): PeriodSummary {
  const inPeriod = txs.filter((t) => inRange(t.date, range));
  let income = 0;
  let expense = 0;
  let pending = 0;
  let fixed = 0;
  let shared = 0;
  const byCat = new Map<string, number>();
  const byPerson = new Map<string, number>();
  const indByPerson = new Map<string, number>();
  let biggest: { description: string; amount: number } | null = null;
  let count = 0;

  for (const t of inPeriod) {
    const c = toCents(t.amount);
    if (t.kind === "income" || t.kind === "expense") count++;
    if (isRealizedIncome(t)) income += c;
    if (t.kind === "expense" && t.status === "pending") pending += c;
    if (!isRealizedExpense(t)) continue;
    expense += c;
    if (isFixedExpense(t)) fixed += c;
    if (t.scope === "shared") shared += c;
    else indByPerson.set(t.owner_id, (indByPerson.get(t.owner_id) ?? 0) + c);
    const ck = t.category_id ?? "none";
    byCat.set(ck, (byCat.get(ck) ?? 0) + c);
    byPerson.set(t.owner_id, (byPerson.get(t.owner_id) ?? 0) + c);
    if (!biggest || c > toCents(biggest.amount)) biggest = { description: t.description, amount: fromCents(c) };
  }

  const catMeta = (key: string) => {
    const c = categories.find((x) => x.id === key);
    return { label: c?.name ?? "Sem categoria", color: c?.color ?? "#9AA1AE" };
  };
  const personMeta = (key: string) => {
    const idx = members.findIndex((m) => m.user_id === key);
    return {
      label: members[idx]?.full_name?.split(" ")[0] ?? "Membro",
      color: PERSON_COLORS[idx >= 0 ? idx % PERSON_COLORS.length : 3],
    };
  };

  return {
    income: fromCents(income),
    expense: fromCents(expense),
    net: fromCents(income - expense),
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
    count,
    pendingExpense: fromCents(pending),
    fixedExpense: fromCents(fixed),
    variableExpense: fromCents(expense - fixed),
    sharedExpense: fromCents(shared),
    individualExpense: fromCents(expense - shared),
    byCategory: slices(byCat, catMeta),
    byPerson: slices(byPerson, personMeta),
    individualByPerson: slices(indByPerson, personMeta),
    biggestExpense: biggest,
  };
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export function monthlySeries(txs: Tx[], months: string[]): MonthPoint[] {
  const map = new Map(months.map((m) => [m, { income: 0, expense: 0 }]));
  for (const t of txs) {
    const m = map.get(t.date.slice(0, 7));
    if (!m) continue;
    if (isRealizedIncome(t)) m.income += toCents(t.amount);
    if (isRealizedExpense(t)) m.expense += toCents(t.amount);
  }
  return months.map((month) => {
    const v = map.get(month)!;
    return { month, income: fromCents(v.income), expense: fromCents(v.expense), net: fromCents(v.income - v.expense) };
  });
}

/**
 * Evolução do saldo: parte do saldo atual e "desfaz" os fluxos dos meses seguintes.
 * extraFlows: transferências com sinal (+ entrada / − saída) relativas ao conjunto de contas.
 * Retorna o saldo no fim de cada mês.
 */
export function balanceSeries(
  txs: Tx[],
  months: string[],
  currentBalance: MoneyLike,
  extraFlows: { date: string; amount: MoneyLike }[] = [],
): { month: string; balance: number }[] {
  const flows = new Map(months.map((m) => [m, 0]));
  let afterLast = 0;
  const last = months[months.length - 1];
  const add = (date: string, f: number) => {
    const m = date.slice(0, 7);
    if (flows.has(m)) flows.set(m, flows.get(m)! + f);
    else if (m > last) afterLast += f;
  };
  for (const t of txs) add(t.date, accountFlowCents(t));
  // transferências que entram/saem do conjunto de contas considerado
  for (const x of extraFlows) add(x.date, toCents(x.amount));
  let running = toCents(currentBalance) - afterLast;
  const out: { month: string; balance: number }[] = [];
  for (let i = months.length - 1; i >= 0; i--) {
    out.unshift({ month: months[i], balance: fromCents(running) });
    running -= flows.get(months[i])!;
  }
  return out;
}

const SMALL_NUMBERS = ["nenhuma", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

export interface InsightContext {
  current: PeriodSummary;
  previous: PeriodSummary;
  upcomingBills: number;
  periodLabel: "semana" | "mês" | "período";
  isCouple: boolean;
}

/** Análise textual gerada exclusivamente a partir dos dados registrados. */
export function buildInsights(ctx: InsightContext): string[] {
  const { current: c, previous: p, periodLabel } = ctx;
  const out: string[] = [];
  const subj = ctx.isCouple ? "Vocês" : "Você";
  const nesta = periodLabel === "semana" ? "nesta semana" : periodLabel === "mês" ? "neste mês" : "no período";
  const anterior = periodLabel === "semana" ? "na semana anterior" : periodLabel === "mês" ? "no mês anterior" : "no período anterior";

  if (c.count === 0) {
    out.push(`Nenhuma movimentação foi registrada ${nesta}.`);
  } else {
    if (p.expense > 0 && c.expense >= 0) {
      const diff = ((c.expense - p.expense) / p.expense) * 100;
      const verb = ctx.isCouple ? "gastaram" : "gastou";
      if (Math.abs(diff) < 1) out.push(`${subj} ${verb} praticamente o mesmo que ${anterior}.`);
      else
        out.push(
          `${subj} ${verb} ${Math.abs(diff).toFixed(0)}% ${diff < 0 ? "menos" : "mais"} que ${anterior} (${formatBRL(c.expense)} contra ${formatBRL(p.expense)}).`,
        );
    }
    const top = c.byCategory[0];
    if (top) out.push(`${top.label} foi a categoria com maior despesa: ${formatBRL(top.total)} (${top.percent.toFixed(0)}% do total).`);

    if (ctx.isCouple && c.individualByPerson.length > 0 && c.individualExpense > 0) {
      const lead = c.individualByPerson[0];
      out.push(`${lead.label} concentrou ${lead.percent.toFixed(0)}% das despesas individuais.`);
    }
    if (c.expense > 0 && c.sharedExpense > 0) {
      out.push(`${((c.sharedExpense / c.expense) * 100).toFixed(0)}% dos gastos foram despesas compartilhadas do casal.`);
    }
    if (c.income > 0 || c.expense > 0) {
      if (c.net > 0) out.push(`${subj} ${ctx.isCouple ? "economizaram" : "economizou"} ${formatBRL(c.net)} ${nesta}.`);
      else if (c.net < 0) out.push(`As despesas superaram as receitas em ${formatBRL(Math.abs(c.net))} ${nesta}.`);
    }
    if (c.biggestExpense) out.push(`A maior despesa foi "${c.biggestExpense.description}" (${formatBRL(c.biggestExpense.amount)}).`);
  }

  if (ctx.upcomingBills > 0) {
    const n = ctx.upcomingBills <= 10 ? SMALL_NUMBERS[ctx.upcomingBills] : String(ctx.upcomingBills);
    const word = ctx.upcomingBills === 1 ? "conta" : "contas";
    out.push(`${ctx.upcomingBills === 1 ? "Existe" : "Existem"} ${n} ${word} com vencimento nos próximos sete dias.`);
  } else {
    out.push("Não há contas com vencimento nos próximos sete dias.");
  }
  return out;
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ; como separador (padrão do Excel em pt-BR) + BOM para acentuação
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
}
