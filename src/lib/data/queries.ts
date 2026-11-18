import "server-only";
import { createClient } from "@/lib/supabase/server";
import { matchesPerspective } from "@/lib/perspective";
import type {
  Account, AppNotification, Budget, CreditCard, Debt, DebtInstallment, Goal, GoalContribution, Invoice,
  RecurringInstance, RecurringTransaction, Transaction, Transfer,
} from "@/lib/types";
import type { AppContext } from "./context";

const TX_COLUMNS =
  "id, kind, status, description, amount, category_id, date, due_date, paid_at, account_id, credit_card_id, invoice_id, payment_method, owner_id, scope, visibility, notes, installment_group, installment_number, installment_total, recurring_instance_id, debt_id, debt_installment_id, is_demo, created_at";

export function byPerspective<T extends { owner_id: string; scope: "individual" | "shared" }>(ctx: AppContext, rows: T[]): T[] {
  return rows.filter((r) => matchesPerspective(r, ctx.perspective, ctx.userId));
}

export async function getAccounts(ctx: AppContext, opts: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const supabase = await createClient();
  let q = supabase.from("accounts").select("*").eq("household_id", ctx.household.id).order("created_at");
  if (!opts.includeArchived) q = q.is("archived_at", null);
  const [{ data: accounts }, { data: balances }] = await Promise.all([
    q,
    supabase.rpc("account_balances", { p_household: ctx.household.id }),
  ]);
  const map = new Map<string, number>((balances ?? []).map((b: { account_id: string; balance: string | number }) => [b.account_id, Number(b.balance)]));
  return (accounts ?? []).map((a) => ({ ...a, balance: map.get(a.id) ?? Number(a.initial_balance) })) as Account[];
}

export async function getTransactions(
  ctx: AppContext,
  opts: { from?: string; to?: string; limit?: number; kinds?: string[]; includeDeleted?: boolean } = {},
): Promise<Transaction[]> {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("household_id", ctx.household.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (!opts.includeDeleted) q = q.is("deleted_at", null);
  if (opts.from) q = q.gte("date", opts.from);
  if (opts.to) q = q.lte("date", opts.to);
  if (opts.kinds) q = q.in("kind", opts.kinds);
  q = q.limit(opts.limit ?? 5000);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

export async function getCards(ctx: AppContext): Promise<CreditCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("household_id", ctx.household.id)
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []) as CreditCard[];
}

export async function getInvoices(ctx: AppContext, cardId?: string): Promise<Invoice[]> {
  const supabase = await createClient();
  let q = supabase.from("v_card_invoices").select("*").eq("household_id", ctx.household.id).order("reference_month");
  if (cardId) q = q.eq("card_id", cardId);
  const { data } = await q;
  return (data ?? []) as Invoice[];
}

export async function getRecurring(ctx: AppContext): Promise<RecurringTransaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("household_id", ctx.household.id)
    .order("name");
  return (data ?? []) as RecurringTransaction[];
}

export async function getRecurringInstances(ctx: AppContext, opts: { from?: string; to?: string } = {}): Promise<RecurringInstance[]> {
  const supabase = await createClient();
  let q = supabase.from("recurring_instances").select("*").eq("household_id", ctx.household.id).order("due_date");
  if (opts.from) q = q.gte("due_date", opts.from);
  if (opts.to) q = q.lte("due_date", opts.to);
  const { data } = await q;
  return (data ?? []) as RecurringInstance[];
}

export async function getDebts(ctx: AppContext): Promise<Debt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_debts")
    .select("*")
    .eq("household_id", ctx.household.id)
    .order("priority")
    .order("created_at");
  return (data ?? []) as Debt[];
}

export async function getDebtInstallments(ctx: AppContext, debtId?: string): Promise<DebtInstallment[]> {
  const supabase = await createClient();
  let q = supabase.from("v_debt_installments").select("*").eq("household_id", ctx.household.id).order("due_date");
  if (debtId) q = q.eq("debt_id", debtId);
  const { data } = await q;
  return (data ?? []) as DebtInstallment[];
}

export async function getGoals(ctx: AppContext): Promise<{ goals: Goal[]; contributions: GoalContribution[] }> {
  const supabase = await createClient();
  const [{ data: goals }, { data: contributions }] = await Promise.all([
    supabase.from("financial_goals").select("*").eq("household_id", ctx.household.id).order("created_at"),
    supabase.from("goal_contributions").select("*").eq("household_id", ctx.household.id).order("date"),
  ]);
  return { goals: (goals ?? []) as Goal[], contributions: (contributions ?? []) as GoalContribution[] };
}

export async function getBudgets(ctx: AppContext): Promise<Budget[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("budgets").select("*").eq("household_id", ctx.household.id);
  return (data ?? []) as Budget[];
}

export async function getTransfers(ctx: AppContext, opts: { from?: string; to?: string } = {}): Promise<Transfer[]> {
  const supabase = await createClient();
  let q = supabase
    .from("transfers")
    .select("*")
    .eq("household_id", ctx.household.id)
    .is("deleted_at", null)
    .order("date", { ascending: false });
  if (opts.from) q = q.gte("date", opts.from);
  if (opts.to) q = q.lte("date", opts.to);
  const { data } = await q;
  return (data ?? []) as Transfer[];
}

export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function syncHousehold(ctx: AppContext) {
  const supabase = await createClient();
  await supabase.rpc("sync_household", { p_household: ctx.household.id });
}
