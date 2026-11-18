import "server-only";
import { addDays } from "date-fns";
import { getAppContext } from "./context";
import { getAccounts, getCards } from "./cached";
import {
  byPerspective, getBudgets, getDebtInstallments, getDebts, getGoals, getInvoices, getRecurring,
  getRecurringInstances, getTransactions, getTransfers,
} from "./queries";
import { lastMonths, monthRange, parseISODate, previousMonth, toISODate, todayISO } from "@/lib/dates";
import { fromCents, percentChange, sumMoney, toCents } from "@/lib/money";
import { balanceSeries, isFixedExpense, isRealizedExpense, monthlySeries, summarize } from "@/lib/finance/reports";
import { buildObligations } from "@/lib/finance/obligations";

export async function loadDashboard(month: string) {
  const ctx = await getAppContext();
  const today = todayISO();
  const range = monthRange(month);
  const months = lastMonths(month, 6);
  const seriesFrom = monthRange(months[0]).from;
  const fetchTo = range.to > today ? range.to : today;

  const [accountsAll, cardsAll, txAll, invoicesAll, recurringAll, instances, debtsAll, installmentsAll, goalsData, budgets, transfers] =
    await Promise.all([
      getAccounts(ctx),
      getCards(ctx),
      getTransactions(ctx, { from: seriesFrom, to: fetchTo > range.to ? fetchTo : range.to }),
      getInvoices(ctx),
      getRecurring(ctx),
      getRecurringInstances(ctx, {
        from: toISODate(addDays(parseISODate(range.from < today ? range.from : today), -31)),
        to: toISODate(addDays(parseISODate(range.to > today ? range.to : today), 31)),
      }),
      getDebts(ctx),
      getDebtInstallments(ctx),
      getGoals(ctx),
      getBudgets(ctx),
      getTransfers(ctx, { from: seriesFrom }),
    ]);

  const accounts = byPerspective(ctx, accountsAll);
  const cards = byPerspective(ctx, cardsAll);
  const cardIds = new Set(cards.map((c) => c.id));
  const txs = byPerspective(ctx, txAll);
  const invoices = invoicesAll.filter((i) => cardIds.has(i.card_id));
  const recurring = byPerspective(ctx, recurringAll);
  const debts = byPerspective(ctx, debtsAll);
  const debtIds = new Set(debts.map((d) => d.id));
  const installments = installmentsAll.filter((i) => debtIds.has(i.debt_id));
  const goals = byPerspective(ctx, goalsData.goals).filter((g) => g.status !== "archived");

  const current = summarize(txs, range, ctx.categories, ctx.members);
  const prevRange = monthRange(previousMonth(month));
  const previous = summarize(txs, prevRange, ctx.categories, ctx.members);

  // ---------- saldos ----------
  const liquid = accounts.filter((a) => a.include_in_total && a.type !== "investment");
  const totalBalance = sumMoney(liquid.map((a) => a.balance ?? 0));
  const invested = sumMoney(accounts.filter((a) => a.type === "investment").map((a) => a.balance ?? 0));
  const liquidIds = new Set(liquid.map((a) => a.id));
  const liquidTx = txs.filter((t) => !t.account_id || liquidIds.has(t.account_id));
  const transferFlows = transfers.flatMap((x) => {
    const inn = liquidIds.has(x.to_account_id);
    const out = liquidIds.has(x.from_account_id);
    if (inn === out) return []; // movimento interno ao conjunto: não altera o total
    return [{ date: x.date, amount: inn ? Number(x.amount) : -Number(x.amount) }];
  });
  const balancePoints = balanceSeries(liquidTx, months, totalBalance, transferFlows);
  const prevBalance = balancePoints.length > 1 ? balancePoints[balancePoints.length - 2].balance : null;

  // ---------- compromissos ----------
  const obligations = buildObligations({
    instances,
    recurring,
    pendingTransactions: txs.filter((t) => t.status === "pending"),
    installments,
    debts,
    invoices,
    cards,
    today,
  });
  const outInMonth = obligations.filter((o) => o.direction === "out" && o.dueDate >= range.from && o.dueDate <= range.to);
  const pendingOut = obligations.filter((o) => o.direction === "out" && o.status !== "paid" && (o.dueDate <= range.to));
  const toPay = sumMoney(pendingOut.map((o) => o.amount));
  const overdueCount = pendingOut.filter((o) => o.status === "overdue").length;
  const expectedIncome = sumMoney(
    obligations.filter((o) => o.direction === "in" && o.status !== "paid" && o.dueDate >= range.from && o.dueDate <= range.to).map((o) => o.amount),
  );
  const committed = sumMoney(outInMonth.map((o) => o.amount));
  const incomeBase = current.income + expectedIncome;
  const commitmentPct = incomeBase > 0 ? (committed / incomeBase) * 100 : null;

  // ---------- dívidas ----------
  const activeDebts = debts.filter((d) => d.status === "active");
  const debtOutstanding = sumMoney(activeDebts.map((d) => d.outstanding));
  const debtThisMonth = installments.filter((i) => i.due_date >= range.from && i.due_date <= range.to && i.status !== "paid").length;

  // ---------- séries ----------
  const series = monthlySeries(txs, months);
  const prevSeriesMonth = series.length > 1 ? series[series.length - 2] : null;
  const spendingSeries = months.map((m) => {
    const r = monthRange(m);
    let fixed = 0;
    let variable = 0;
    for (const t of txs) {
      if (t.date < r.from || t.date > r.to || !isRealizedExpense(t)) continue;
      if (isFixedExpense(t)) fixed += toCents(t.amount);
      else variable += toCents(t.amount);
    }
    return { month: m, fixed: fromCents(fixed), variable: fromCents(variable) };
  });

  // ---------- orçamentos ----------
  const budgetRows = budgets
    .map((b) => {
      const cat = ctx.categories.find((c) => c.id === b.category_id);
      const spent = sumMoney(
        txs.filter((t) => t.category_id === b.category_id && isRealizedExpense(t) && t.date >= range.from && t.date <= range.to).map((t) => t.amount),
      );
      return { ...b, name: cat?.name ?? "Categoria", color: cat?.color ?? "#7A8190", icon: cat?.icon ?? "circle", spent, pct: (spent / Number(b.amount)) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  // ---------- metas ----------
  const goalRows = goals.map((g) => {
    const saved = sumMoney(goalsData.contributions.filter((c) => c.goal_id === g.id).map((c) => c.amount));
    return { ...g, saved, pct: Math.min(100, (saved / Number(g.target_amount)) * 100) };
  });

  const savedThisMonth = current.net;

  return {
    ctx,
    month,
    today,
    kpis: {
      totalBalance,
      balanceChange: prevBalance !== null && liquid.length > 0 ? percentChange(totalBalance, prevBalance) : null,
      income: current.income,
      incomeChange: percentChange(current.income, previous.income),
      expense: current.expense,
      expenseChange: percentChange(current.expense, previous.expense),
      net: current.net,
      netPrev: previous.net,
      debtOutstanding,
      activeDebts: activeDebts.length,
      debtThisMonth,
      toPay,
      toPayCount: pendingOut.length,
      overdueCount,
      invested,
      commitmentPct,
      committed,
      incomeBase,
      expectedIncome,
      pendingExpense: current.pendingExpense,
    },
    summary: {
      received: current.income,
      spent: current.expense,
      canSpend: incomeBase - current.expense - toPay,
      committed: toPay,
      saved: savedThisMonth,
    },
    current,
    series,
    balancePoints,
    spendingSeries,
    prevSeriesMonth,
    upcoming: obligations
      .filter((o) => o.direction === "out" && (o.status !== "paid" ? o.dueDate <= toISODate(addDays(parseISODate(today), 30)) : o.dueDate >= range.from && o.dueDate <= range.to))
      .sort((a, b) => {
        const rank = (s: string) => (s === "overdue" ? 0 : s === "pending" ? 1 : 2);
        return rank(a.status) - rank(b.status) || a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 8),
    recent: txs.filter((t) => t.kind === "income" || t.kind === "expense").slice(0, 6),
    accounts: accounts.slice(0, 5),
    budgets: budgetRows.slice(0, 4),
    goals: goalRows.slice(0, 3),
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
