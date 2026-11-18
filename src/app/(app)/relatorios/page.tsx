import { addDays } from "date-fns";
import {
  ArrowDownLeft, ArrowUpRight, CheckCircle2, CircleDashed, Hash, HandCoins, Lightbulb, PartyPopper, Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/page-header";
import { PeriodBar } from "@/components/reports/period-bar";
import { ChangeBadge } from "@/components/dashboard/kpi-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { PersonBars } from "@/components/charts/person-bars";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { getAppContext, memberName } from "@/lib/data/context";
import { getCards } from "@/lib/data/cached";
import {
  byPerspective, getDebtInstallments, getDebts, getInvoices, getRecurring, getRecurringInstances, getTransactions,
} from "@/lib/data/queries";
import { buildObligations } from "@/lib/finance/obligations";
import { buildInsights, monthlySeries, summarize } from "@/lib/finance/reports";
import { resolvePeriod, type PeriodKind } from "@/lib/finance/periods";
import { formatDate, inRange, isValidISODate, lastMonths, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { formatBRL, formatDecimal, percentChange, sumMoney } from "@/lib/money";
import { perspectiveLabel } from "@/lib/perspective";
import { firstName } from "@/lib/utils";

export const metadata = { title: "Relatórios" };

type SP = { periodo?: string; data?: string; de?: string; ate?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const kind: PeriodKind = (["semana", "mes", "trimestre", "ano", "custom"] as const).includes(sp.periodo as PeriodKind)
    ? (sp.periodo as PeriodKind)
    : "semana";
  const today = todayISO();
  const anchor = isValidISODate(sp.data) ? sp.data : today;
  const { range, previous, label } = resolvePeriod(kind, anchor, sp.de, sp.ate);
  const ctx = await getAppContext();
  const next7 = toISODate(addDays(parseISODate(today), 7));

  const [txAll, recAll, instAll, debtsAll, installmentsAll, invoicesAll, cardsAll] = await Promise.all([
    getTransactions(ctx, { from: previous.from < range.from ? previous.from : range.from, to: range.to > next7 ? range.to : next7 }),
    getRecurring(ctx),
    getRecurringInstances(ctx, { from: range.from, to: range.to > next7 ? range.to : next7 }),
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
  const debtIds = new Set(debts.map((d) => d.id));
  const installments = installmentsAll.filter((i) => debtIds.has(i.debt_id));

  const current = summarize(txs, range, ctx.categories, ctx.members);
  const prev = summarize(txs, previous, ctx.categories, ctx.members);

  const obligations = buildObligations({
    instances: instAll,
    recurring,
    pendingTransactions: txs.filter((t) => t.status === "pending"),
    installments,
    debts,
    invoices,
    cards,
    today,
  }).filter((o) => o.direction === "out");

  const upcomingBills = obligations.filter((o) => o.status !== "paid" && o.dueDate >= today && o.dueDate <= next7).length;
  const paidBills = obligations.filter((o) => o.status === "paid" && inRange(o.dueDate, range));
  const pendingBills = obligations.filter((o) => o.status !== "paid" && (inRange(o.dueDate, range) || (o.status === "overdue" && o.dueDate < range.from && range.to >= today)));
  const newDebts = debts.filter((d) => inRange(d.created_at.slice(0, 10), range));
  const paidOffDebts = debts.filter((d) => d.paid_off_at && inRange(d.paid_off_at, range));

  const insights = buildInsights({
    current,
    previous: prev,
    upcomingBills,
    periodLabel: kind === "semana" ? "semana" : kind === "mes" ? "mês" : "período",
    isCouple: ctx.members.length > 1 && ctx.perspective !== "me" && ctx.perspective !== "partner",
  });
  if (paidOffDebts.length) insights.push(`${paidOffDebts.length === 1 ? "Uma dívida foi quitada" : `${paidOffDebts.length} dívidas foram quitadas`} no período: ${paidOffDebts.map((d) => d.name).join(", ")}.`);
  if (newDebts.length) insights.push(`${newDebts.length === 1 ? "Uma nova dívida foi registrada" : `${newDebts.length} novas dívidas foram registradas`} no período.`);

  const categoryCompare = current.byCategory.map((c) => {
    const p = prev.byCategory.find((x) => x.key === c.key)?.total ?? 0;
    return { ...c, prev: p, change: percentChange(c.total, p) };
  });

  const showMonthly = kind === "trimestre" || kind === "ano";
  const monthsInRange = showMonthly ? lastMonths(range.to.slice(0, 7), kind === "ano" ? 12 : 3) : [];
  const series = showMonthly ? monthlySeries(txs, monthsInRange) : [];

  const csvRows: (string | number)[][] = [
    ["Relatório", label],
    ["Perspectiva", perspectiveLabel(ctx.perspective, ctx.partner ? firstName(ctx.partner.full_name) : undefined)],
    [],
    ["Indicador", "Período atual", "Período anterior"],
    ["Recebido", formatDecimal(current.income), formatDecimal(prev.income)],
    ["Gasto", formatDecimal(current.expense), formatDecimal(prev.expense)],
    ["Saldo", formatDecimal(current.net), formatDecimal(prev.net)],
    ["Transações", current.count, prev.count],
    [],
    ["Categoria", "Total", "%", "Período anterior"],
    ...categoryCompare.map((c) => [c.label, formatDecimal(c.total), c.percent.toFixed(1), formatDecimal(c.prev)]),
    [],
    ["Pessoa", "Total", "%"],
    ...current.byPerson.map((p) => [p.label, formatDecimal(p.total), p.percent.toFixed(1)]),
    [],
    ["Análise"],
    ...insights.map((i) => [i]),
  ];

  const kpis = [
    { l: "Total recebido", v: current.income, c: percentChange(current.income, prev.income), icon: ArrowDownLeft, inverse: false },
    { l: "Total gasto", v: current.expense, c: percentChange(current.expense, prev.expense), icon: ArrowUpRight, inverse: true },
    { l: "Saldo do período", v: current.net, c: null, icon: Scale, inverse: false, hint: `Anterior: ${formatBRL(prev.net)}` },
    { l: "Transações", v: null, n: current.count, c: percentChange(current.count, prev.count), icon: Hash, inverse: false },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader className="mb-0 md:mb-2" title="Relatórios" description={`${label} · ${perspectiveLabel(ctx.perspective, ctx.partner ? firstName(ctx.partner.full_name) : undefined)}`} />
      <PeriodBar kind={kind} anchor={anchor} label={label} from={range.from} to={range.to} csvRows={csvRows} filename={`relatorio-${kind}-${range.from}`} />

      <Card className="hero-gradient border-0 p-6 text-white md:p-7">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15"><Lightbulb className="size-[18px]" /></span>
          <h2 className="text-lg font-semibold tracking-tight">
            {kind === "semana" ? "Como foi nossa semana financeira?" : kind === "mes" ? "Como foi nosso mês financeiro?" : "Como foi nosso período financeiro?"}
          </h2>
        </div>
        <ul className="mt-5 grid gap-2.5 md:grid-cols-2">
          {insights.map((i) => (
            <li key={i} className="flex gap-2.5 rounded-2xl bg-white/[0.08] px-4 py-3 text-[14px] leading-snug text-white/90 backdrop-blur">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/70" />
              {i}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11.5px] text-white/55">Análise calculada exclusivamente a partir das movimentações registradas no período {formatDate(range.from)} – {formatDate(range.to)}.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.l} className="p-4">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><k.icon className="size-3.5" />{k.l}</p>
            <p className={`mt-1 text-xl font-semibold tabular ${k.v !== null && k.v < 0 ? "text-negative" : ""}`}>{k.v !== null ? formatBRL(k.v) : k.n}</p>
            <div className="mt-1.5">{k.hint ? <p className="text-[11.5px] text-muted-foreground">{k.hint}</p> : <ChangeBadge value={k.c} inverse={k.inverse} suffix="vs anterior" />}</div>
          </Card>
        ))}
      </div>

      {showMonthly && (
        <Card>
          <CardHeader title="Receitas x despesas por mês" />
          <CardContent className="pt-3"><IncomeExpenseChart data={series} /></CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Gastos por categoria" />
          <CardContent>
            {current.byCategory.length ? <DonutChart data={current.byCategory} centerLabel="Total gasto" centerValue={current.expense} /> : <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas no período.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Comparativo com o período anterior" />
          <CardContent className="px-0 pt-3">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-right font-medium">Atual</th>
                  <th className="px-3 py-2 text-right font-medium">Anterior</th>
                  <th className="px-5 py-2 text-right font-medium">Variação</th>
                </tr>
              </thead>
              <tbody>
                {categoryCompare.slice(0, 10).map((c) => (
                  <tr key={c.key} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: c.color }} />{c.label}</span></td>
                    <td className="px-3 py-2.5 text-right font-medium tabular">{formatBRL(c.total)}</td>
                    <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{formatBRL(c.prev)}</td>
                    <td className="px-5 py-2.5 text-right"><ChangeBadge value={c.change} inverse suffix="" /></td>
                  </tr>
                ))}
                {!categoryCompare.length && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Sem dados.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Gastos por pessoa" />
          <CardContent>
            <PersonBars data={current.byPerson} />
            <div className="mt-5 grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-xl bg-surface-2 px-3 py-2"><p className="text-muted-foreground">Compartilhadas</p><p className="font-semibold tabular">{formatBRL(current.sharedExpense)}</p></div>
              <div className="rounded-xl bg-surface-2 px-3 py-2"><p className="text-muted-foreground">Individuais</p><p className="font-semibold tabular">{formatBRL(current.individualExpense)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Contas pagas" description={`${paidBills.length} no período`} />
          <CardContent className="flex flex-col gap-1 pt-3">
            {paidBills.slice(0, 8).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2"><CheckCircle2 className="size-3.5 shrink-0 text-positive" /><span className="truncate">{o.title}</span></span>
                <span className="font-medium tabular">{formatBRL(o.amount)}</span>
              </div>
            ))}
            {!paidBills.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta paga.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Contas pendentes" description={`${pendingBills.length} em aberto`} />
          <CardContent className="flex flex-col gap-1 pt-3">
            {pendingBills.slice(0, 8).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <CircleDashed className={`size-3.5 shrink-0 ${o.status === "overdue" ? "text-negative" : "text-warning"}`} />
                  <span className="truncate">{o.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(o.dueDate, "dd/MM")}</span>
                </span>
                <span className="font-medium tabular">{formatBRL(o.amount)}</span>
              </div>
            ))}
            {!pendingBills.length && <p className="py-6 text-center text-sm text-muted-foreground">Nada pendente. 👏</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Novas dívidas" />
          <CardContent className="pt-3">
            {newDebts.length ? newDebts.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 text-[13px]">
                <span className="flex items-center gap-2"><HandCoins className="size-3.5 text-muted-foreground" />{d.name} <Badge variant="outline">{d.scope === "shared" ? "Casal" : memberName(ctx, d.owner_id)}</Badge></span>
                <span className="font-medium tabular">{formatBRL(d.original_amount)}</span>
              </div>
            )) : <p className="py-4 text-sm text-muted-foreground">Nenhuma nova dívida no período.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Dívidas quitadas" />
          <CardContent className="pt-3">
            {paidOffDebts.length ? paidOffDebts.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 text-[13px]">
                <span className="flex items-center gap-2"><PartyPopper className="size-3.5 text-positive" />{d.name}</span>
                <span className="font-medium tabular">{formatBRL(d.paid_total)}</span>
              </div>
            )) : <p className="py-4 text-sm text-muted-foreground">Nenhuma dívida quitada no período.</p>}
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-[11.5px] text-muted-foreground">
        Gastos consideram despesas realizadas (inclusive compras no cartão na data da compra). Pagamentos de fatura e transferências não são contados como despesa. Total previsto ainda não pago: {formatBRL(sumMoney(pendingBills.map((o) => o.amount)))}.
      </p>
    </div>
  );
}
