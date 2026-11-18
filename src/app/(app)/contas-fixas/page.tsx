import { CalendarCheck2, CalendarClock, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shell/page-header";
import { RecurringManager } from "@/components/recurring/recurring-manager";
import { getAppContext } from "@/lib/data/context";
import { byPerspective, getRecurring, getRecurringInstances } from "@/lib/data/queries";
import { addDays } from "date-fns";
import { monthRange, currentMonth, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { formatBRL, sumMoney } from "@/lib/money";
import { FREQUENCY_PER_MONTH } from "@/lib/constants";

export const metadata = { title: "Contas fixas" };

export default async function RecurringPage() {
  const ctx = await getAppContext();
  const [recAll, instAll] = await Promise.all([getRecurring(ctx), getRecurringInstances(ctx)]);
  const recurring = byPerspective(ctx, recAll);
  const ids = new Set(recurring.map((r) => r.id));
  const instances = instAll.filter((i) => ids.has(i.recurring_id));
  const range = monthRange(currentMonth());
  const active = recurring.filter((r) => r.status === "active");
  const monthlyFixed = sumMoney(active.filter((r) => r.kind === "expense").map((r) => Number(r.amount) * FREQUENCY_PER_MONTH[r.frequency]));
  const expenseIds = new Set(recurring.filter((r) => r.kind === "expense").map((r) => r.id));
  const thisMonth = instances.filter((i) => expenseIds.has(i.recurring_id) && i.due_date >= range.from && i.due_date <= range.to && i.status !== "skipped");
  const paid = thisMonth.filter((i) => i.status === "paid");
  const pendingAmount = sumMoney(thisMonth.filter((i) => i.status === "pending").map((i) => i.amount));
  const today = todayISO();
  const horizon = toISODate(addDays(parseISODate(today), 45));
  const upcoming = instances.filter((i) => i.status === "pending" && i.due_date <= horizon);

  return (
    <div>
      <PageHeader title="Contas fixas" description="Contas recorrentes geradas automaticamente, sem cobranças duplicadas." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Repeat className="size-3.5" /> Custo fixo mensal</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatBRL(monthlyFixed)}</p>
          <p className="text-[12px] text-muted-foreground">{active.filter((r) => r.kind === "expense").length} contas ativas (equivalente mensal)</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><CalendarCheck2 className="size-3.5" /> Pagas no mês</p>
          <p className="mt-1 text-xl font-semibold tabular">{paid.length} de {thisMonth.length}</p>
          <Progress className="mt-2" value={thisMonth.length ? (paid.length / thisMonth.length) * 100 : 0} tone="positive" />
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><CalendarClock className="size-3.5" /> Falta pagar no mês</p>
          <p className="mt-1 text-xl font-semibold tabular text-warning">{formatBRL(pendingAmount)}</p>
          <p className="text-[12px] text-muted-foreground">{instances.filter((i) => i.status === "pending" && i.due_date < today && expenseIds.has(i.recurring_id)).length} vencida(s)</p>
        </Card>
      </div>
      <RecurringManager recurring={recurring} instances={upcoming} history={instances} />
    </div>
  );
}
