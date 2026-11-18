import { PageHeader } from "@/components/shell/page-header";
import { GoalsManager } from "@/components/goals/goals-manager";
import { BudgetsManager } from "@/components/goals/budgets-manager";
import { getAppContext } from "@/lib/data/context";
import { byPerspective, getBudgets, getGoals, getTransactions } from "@/lib/data/queries";
import { currentMonth, formatMonth, monthRange } from "@/lib/dates";
import { sumMoney } from "@/lib/money";
import { projectGoal } from "@/lib/finance/goals";

export const metadata = { title: "Metas e orçamentos" };

export default async function GoalsPage() {
  const ctx = await getAppContext();
  const month = currentMonth();
  const range = monthRange(month);
  const [{ goals, contributions }, budgets, txs] = await Promise.all([
    getGoals(ctx),
    getBudgets(ctx),
    getTransactions(ctx, { from: range.from, to: range.to, kinds: ["expense"] }),
  ]);
  const goalRows = byPerspective(ctx, goals)
    .filter((g) => g.status !== "archived")
    .map((g) => {
      const c = contributions.filter((x) => x.goal_id === g.id);
      return { ...g, contributions: c, p: projectGoal(g.target_amount, g.target_date, c) };
    });
  // orçamentos são da família inteira: consideram todas as despesas visíveis
  const budgetRows = budgets
    .map((b) => {
      const spent = sumMoney(txs.filter((t) => t.category_id === b.category_id && t.status === "paid").map((t) => t.amount));
      return { ...b, spent, pct: (spent / Number(b.amount)) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader className="mb-0 md:mb-0" title="Planejamento e metas" description="Objetivos do casal e limites de gastos por categoria." />
      <section><GoalsManager goals={goalRows} /></section>
      <section><BudgetsManager budgets={budgetRows} monthLabel={formatMonth(`${month}-01`)} /></section>
    </div>
  );
}
