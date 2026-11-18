import Link from "next/link";
import {
  ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronRight, Gauge, HandCoins, LineChart, PiggyBank, Scale, Sparkles, Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MonthPicker } from "@/components/shell/month-picker";
import { HeroBalance } from "@/components/dashboard/hero-balance";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { BalanceChart } from "@/components/charts/balance-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { StackedSpendingChart } from "@/components/charts/stacked-spending-chart";
import { PersonBars } from "@/components/charts/person-bars";
import { TransactionList } from "@/components/transactions/transaction-list";
import { loadDashboard } from "@/lib/data/dashboard";
import { memberName } from "@/lib/data/context";
import { currentMonth, formatDate, formatMonth, greeting, isValidMonth, todayISO } from "@/lib/dates";
import { formatBRL, formatPercent } from "@/lib/money";
import { ACCOUNT_TYPE_LABEL } from "@/lib/constants";
import { firstName } from "@/lib/utils";

export const metadata = { title: "Visão geral" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const month = isValidMonth(mes) ? mes : currentMonth();
  const d = await loadDashboard(month);
  const { ctx, kpis, summary, current } = d;
  const nameOf = (id: string) => memberName(ctx, id);
  const isEmpty = d.accounts.length === 0 && current.count === 0;
  const commitTone = kpis.commitmentPct === null ? "neutral" : kpis.commitmentPct > 80 ? "negative" : kpis.commitmentPct > 60 ? "warning" : "positive";

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDate(todayISO(), "EEEE, dd 'de' MMMM").replace(/^./, (c) => c.toUpperCase())}
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight md:text-[28px]">
            {greeting()}, {firstName(ctx.me.full_name)}
          </h1>
        </div>
        <MonthPicker month={month} />
      </div>

      {ctx.hasDemoData && <DemoBanner />}

      {isEmpty && !ctx.hasDemoData ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Vamos começar"
            description="Cadastre suas contas bancárias e registre a primeira movimentação. Se quiser explorar antes, carregue os dados de demonstração em Configurações."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/contas" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Cadastrar conta</Link>
                <Link href="/configuracoes?aba=dados" className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">Ver demonstração</Link>
              </div>
            }
          />
        </Card>
      ) : null}

      {/* Saldo + KPIs */}
      <div className="grid gap-4 md:gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <HeroBalance
            balance={kpis.totalBalance}
            change={kpis.balanceChange}
            income={kpis.income}
            expense={kpis.expense}
            accountsCount={d.accounts.length}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:col-span-7">
          <KpiCard label="Receitas do mês" value={kpis.income} icon={ArrowDownLeft} tone="positive" change={kpis.incomeChange}
            hint={kpis.expectedIncome > 0 ? `+ ${formatBRL(kpis.expectedIncome)} previstos` : undefined} />
          <KpiCard label="Despesas do mês" value={kpis.expense} icon={ArrowUpRight} tone="negative" change={kpis.expenseChange} inverse
            hint={kpis.pendingExpense > 0 ? `+ ${formatBRL(kpis.pendingExpense)} previstas` : undefined} />
          <KpiCard
            label="Saldo do mês"
            value={kpis.net}
            icon={Scale}
            tone={kpis.net >= 0 ? "primary" : "negative"}
            valueClassName={kpis.net < 0 ? "text-negative" : undefined}
            hint={`Mês anterior: ${formatBRL(kpis.netPrev)}`}
          />
          <KpiCard
            label="Contas a pagar"
            value={kpis.toPay}
            icon={CalendarClock}
            tone={kpis.overdueCount ? "negative" : "warning"}
            hint={
              kpis.toPayCount === 0
                ? "Tudo em dia"
                : `${kpis.toPayCount} ${kpis.toPayCount === 1 ? "pendente" : "pendentes"}${kpis.overdueCount ? ` · ${kpis.overdueCount} vencida${kpis.overdueCount > 1 ? "s" : ""}` : ""}`
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <KpiCard
          label="Dívidas em aberto"
          value={kpis.debtOutstanding}
          icon={HandCoins}
          tone="neutral"
          hint={kpis.activeDebts ? `${kpis.activeDebts} ativa${kpis.activeDebts > 1 ? "s" : ""} · ${kpis.debtThisMonth} parcela${kpis.debtThisMonth === 1 ? "" : "s"} no mês` : "Nenhuma dívida ativa"}
        />
        <KpiCard label="Total investido" value={kpis.invested} icon={PiggyBank} tone="primary" hint="Contas do tipo investimento" />
        <KpiCard
          className="col-span-2 lg:col-span-1"
          label="Renda comprometida"
          value={formatPercent(kpis.commitmentPct)}
          icon={Gauge}
          tone={commitTone}
          hint={kpis.incomeBase > 0 ? `${formatBRL(kpis.committed)} de ${formatBRL(kpis.incomeBase)} em compromissos do mês` : "Sem receitas no mês"}
        >
          <Progress value={kpis.commitmentPct ?? 0} tone={commitTone === "negative" ? "danger" : commitTone === "warning" ? "warning" : "positive"} />
        </KpiCard>
      </div>

      {/* Receitas x despesas + resumo */}
      <div className="grid gap-4 md:gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Receitas x despesas"
            description="Últimos 6 meses (somente valores realizados)"
            action={
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-income)]" />Receitas</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-expense)]" />Despesas</span>
              </div>
            }
          />
          <CardContent className="pt-3">
            <IncomeExpenseChart data={d.series} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Resumo do mês" description={formatMonth(`${month}-01`)} />
          <CardContent className="flex flex-col gap-1 pt-3">
            {[
              { l: "Já recebemos", v: summary.received, c: "text-positive" },
              { l: "Já gastamos", v: summary.spent, c: "" },
              { l: "Comprometido (a pagar)", v: summary.committed, c: "text-warning" },
              { l: "Ainda podemos gastar", v: summary.canSpend, c: summary.canSpend < 0 ? "text-negative" : "text-primary", strong: true },
              { l: summary.saved >= 0 ? "Economizamos" : "Gastamos além do recebido", v: Math.abs(summary.saved), c: summary.saved >= 0 ? "text-positive" : "text-negative" },
            ].map((r) => (
              <div key={r.l} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${r.strong ? "bg-primary-soft" : ""}`}>
                <span className="text-[13px] text-muted-foreground">{r.l}</span>
                <span className={`text-[15px] font-semibold tabular ${r.c}`}>{formatBRL(r.v)}</span>
              </div>
            ))}
            <p className="mt-2 px-3 text-[11.5px] leading-relaxed text-subtle-foreground">
              &ldquo;Ainda podemos gastar&rdquo; = receitas (recebidas + previstas) − despesas realizadas − contas pendentes até o fim do mês.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Categorias + vencimentos */}
      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Despesas por categoria" description="Onde o dinheiro foi neste mês" />
          <CardContent>
            {current.byCategory.length ? (
              <DonutChart data={current.byCategory} centerLabel="Total gasto" centerValue={current.expense} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa registrada no mês.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Próximos vencimentos"
            description="Vencidos, próximos 30 dias e pagos no mês"
            action={<Link href="/calendario" className="flex items-center gap-0.5 text-[13px] font-medium text-primary">Calendário <ChevronRight className="size-4" /></Link>}
          />
          <CardContent className="px-3 pt-3 md:px-3">
            {d.upcoming.length ? (
              <UpcomingList items={d.upcoming} nameOf={nameOf} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhum vencimento próximo. 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saldo + fixas x variáveis */}
      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Evolução do saldo" description="Saldo disponível ao fim de cada mês" action={<LineChart className="size-4 text-muted-foreground" />} />
          <CardContent className="pt-3">
            <BalanceChart data={d.balancePoints} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Evolução dos gastos"
            description="Despesas fixas (contas fixas e dívidas) x variáveis"
            action={
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Fixas</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#E08A2E]" />Variáveis</span>
              </div>
            }
          />
          <CardContent className="pt-3">
            <StackedSpendingChart data={d.spendingSeries} />
            <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                <p className="text-muted-foreground">Fixas no mês</p>
                <p className="font-semibold tabular">{formatBRL(current.fixedExpense)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                <p className="text-muted-foreground">Variáveis no mês</p>
                <p className="font-semibold tabular">{formatBRL(current.variableExpense)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pessoa + orçamentos + metas */}
      <div className="grid gap-4 md:gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Despesas por pessoa" description="Quem foi responsável pelos gastos" />
          <CardContent>
            <PersonBars data={current.byPerson} />
            {current.expense > 0 && (
              <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
                <span className="text-muted-foreground">Compartilhadas do casal</span>
                <span className="font-semibold tabular">{formatBRL(current.sharedExpense)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Orçamentos" description="Limites por categoria no mês" action={<Link href="/metas" className="text-[13px] font-medium text-primary">Ver todos</Link>} />
          <CardContent className="flex flex-col gap-4">
            {d.budgets.length ? (
              d.budgets.map((b) => (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2 font-medium"><CategoryIcon icon={b.icon} color={b.color} size="sm" />{b.name}</span>
                    <span className="tabular text-muted-foreground">
                      <span className={b.pct > 100 ? "font-semibold text-negative" : "font-semibold text-foreground"}>{formatBRL(b.spent)}</span> / {formatBRL(b.amount)}
                    </span>
                  </div>
                  <Progress value={b.pct} tone={b.pct > 100 ? "danger" : b.pct >= b.alert_threshold ? "warning" : "default"} />
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Defina limites por categoria em Metas.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Metas" description="Objetivos do casal" action={<Link href="/metas" className="text-[13px] font-medium text-primary">Ver todas</Link>} />
          <CardContent className="flex flex-col gap-4">
            {d.goals.length ? (
              d.goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2 font-medium"><CategoryIcon icon={g.icon} color={g.color} size="sm" />{g.name}</span>
                    <span className="font-semibold tabular">{g.pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={g.pct} color={g.color} />
                  <p className="mt-1 text-[11.5px] text-muted-foreground tabular">{formatBRL(g.saved)} de {formatBRL(g.target_amount)}</p>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Crie a primeira meta do casal.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas movimentações + contas */}
      <div className="grid gap-4 md:gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Últimas movimentações"
            action={<Link href="/movimentacoes" className="flex items-center gap-0.5 text-[13px] font-medium text-primary">Ver todas <ChevronRight className="size-4" /></Link>}
          />
          <CardContent className="px-2 pt-2 md:px-2">
            {d.recent.length ? <TransactionList transactions={d.recent} grouped={false} /> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>}
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader title="Contas" action={<Link href="/contas" className="text-[13px] font-medium text-primary">Gerenciar</Link>} />
          <CardContent className="flex flex-col gap-1 px-3 pt-3">
            {d.accounts.length ? (
              d.accounts.map((a) => (
                <Link key={a.id} href="/contas" className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                  <span className="flex size-9 items-center justify-center rounded-xl text-white" style={{ background: a.color }}>
                    <Wallet className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{a.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {a.institution ?? ACCOUNT_TYPE_LABEL[a.type]} · {a.scope === "shared" ? "Casal" : nameOf(a.owner_id)}
                    </p>
                  </div>
                  <p className={`text-[14px] font-semibold tabular ${(a.balance ?? 0) < 0 ? "text-negative" : ""}`}>{formatBRL(a.balance)}</p>
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
