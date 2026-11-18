import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, Percent, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BalanceChart } from "@/components/charts/balance-chart";
import { DebtHeaderActions, InstallmentsTable } from "@/components/debts/debt-actions";
import { getAppContext, memberName } from "@/lib/data/context";
import { getDebtInstallments, getTransactions } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { debtProgress, payoffSimulation } from "@/lib/finance/debt";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBRL, fromCents, subtractMoney, toCents } from "@/lib/money";
import { DEBT_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import type { Debt } from "@/lib/types";

export const metadata = { title: "Dívida" };

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: debt } = await supabase.from("v_debts").select("*").eq("id", id).maybeSingle<Debt>();
  if (!debt) notFound();
  const [installments, txs] = await Promise.all([getDebtInstallments(ctx, id), getTransactions(ctx, { kinds: ["expense"] })]);
  const payments = txs.filter((t) => t.debt_id === id && t.status === "paid").sort((a, b) => a.date.localeCompare(b.date));
  const pending = installments.filter((i) => i.status !== "paid");
  const sim = payoffSimulation(pending.map((i) => ({ due_date: i.due_date, remaining: subtractMoney(i.amount, i.paid_amount) })), Number(debt.interest_rate), todayISO());
  const pct = debtProgress(debt.paid_total, debt.total_to_pay);

  // evolução do saldo devedor por mês
  const months = new Map<string, number>();
  let running = toCents(debt.total_to_pay);
  const startMonth = (debt.contract_date < debt.first_due_date ? debt.contract_date : debt.first_due_date).slice(0, 7);
  months.set(startMonth, running);
  for (const p of payments) {
    running -= toCents(p.amount);
    months.set(p.date.slice(0, 7), Math.max(0, running));
  }
  const evolution = [...months.entries()].sort().map(([month, c]) => ({ month, balance: fromCents(c) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dividas" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Dívidas</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold tracking-tight">{debt.name}</h1>
            <Badge variant={debt.status === "paid_off" ? "positive" : debt.status === "canceled" ? "neutral" : "primary"}>
              {debt.status === "paid_off" ? "Quitada" : debt.status === "canceled" ? "Cancelada" : "Ativa"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {DEBT_TYPE_LABEL[debt.type]} · {debt.creditor ?? "Credor não informado"} · {debt.scope === "shared" ? "Casal" : memberName(ctx, debt.owner_id)} · prioridade {PRIORITY_LABEL[debt.priority].toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><DebtHeaderActions debt={debt} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Saldo devedor", v: formatBRL(debt.outstanding), icon: Wallet },
          { l: "Já pago", v: formatBRL(debt.paid_total), icon: PiggyBank },
          { l: "Valor original", v: formatBRL(debt.original_amount), sub: `Total com juros: ${formatBRL(debt.total_to_pay)}`, icon: Percent },
          { l: "Término previsto", v: debt.last_due_date ? formatDate(debt.last_due_date, "MM/yyyy") : "—", sub: `${debt.pending_count} parcela(s) restantes`, icon: CalendarCheck },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><k.icon className="size-3.5" />{k.l}</p>
            <p className="mt-1 text-lg font-semibold tabular">{k.v}</p>
            {k.sub && <p className="text-[11.5px] text-muted-foreground">{k.sub}</p>}
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="font-medium">Progresso de quitação</span>
          <span className="font-semibold tabular">{pct.toFixed(1)}%</span>
        </div>
        <Progress value={pct} tone="positive" className="h-3" />
        <p className="mt-2 text-[12px] text-muted-foreground">{debt.paid_count} de {debt.installments_count} parcelas pagas</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Evolução do saldo devedor" />
          <CardContent className="pt-3">{evolution.length > 1 ? <BalanceChart data={evolution} /> : <p className="py-12 text-center text-sm text-muted-foreground">Os pagamentos aparecerão aqui.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Simular quitação" description="Quitar tudo hoje" />
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-[12px] text-muted-foreground">Soma das parcelas restantes</p>
              <p className="text-lg font-semibold tabular">{formatBRL(sim.nominal)}</p>
            </div>
            <div className="rounded-2xl bg-primary-soft p-4">
              <p className="text-[12px] text-primary">Valor estimado para quitar hoje</p>
              <p className="text-2xl font-semibold tracking-tight tabular text-primary">{formatBRL(sim.payoffToday)}</p>
              {sim.savings > 0 && <p className="mt-1 text-[12px] text-positive">Economia estimada de {formatBRL(sim.savings)} em juros</p>}
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Estimativa pelo valor presente das parcelas à taxa de {Number(debt.interest_rate).toLocaleString("pt-BR")}% a.m. O valor exato deve ser confirmado com o credor (o CDC garante o abatimento proporcional dos juros na quitação antecipada).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Parcelas" description="Pague parcelas individuais ou parcialmente" />
        <CardContent className="px-0 pb-2 pt-3"><InstallmentsTable debt={debt} installments={installments} /></CardContent>
      </Card>
      {debt.notes && <Card className="p-5 text-sm text-muted-foreground">{debt.notes}</Card>}
    </div>
  );
}
