import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, HandCoins, PiggyBank, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { NewDebtButton } from "@/components/debts/new-debt-button";
import { getAppContext, memberName } from "@/lib/data/context";
import { byPerspective, getDebtInstallments, getDebts } from "@/lib/data/queries";
import { currentMonth, formatDate, monthRange, todayISO } from "@/lib/dates";
import { formatBRL, subtractMoney, sumMoney } from "@/lib/money";
import { debtPriorityScore, debtProgress } from "@/lib/finance/debt";
import { DEBT_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";

export const metadata = { title: "Dívidas" };

export default async function DebtsPage() {
  const ctx = await getAppContext();
  const [all, installmentsAll] = await Promise.all([getDebts(ctx), getDebtInstallments(ctx)]);
  const debts = byPerspective(ctx, all).filter((d) => d.status !== "canceled");
  const ids = new Set(debts.map((d) => d.id));
  const installments = installmentsAll.filter((i) => ids.has(i.debt_id));
  const today = todayISO();
  const range = monthRange(currentMonth());
  const active = debts.filter((d) => d.status === "active");
  const total = sumMoney(active.map((d) => d.total_to_pay));
  const paid = sumMoney(active.map((d) => d.paid_total));
  const remaining = sumMoney(active.map((d) => d.outstanding));
  const monthInst = installments.filter((i) => i.due_date >= range.from && i.due_date <= range.to && i.status !== "paid" && active.some((d) => d.id === i.debt_id));
  const monthAmount = sumMoney(monthInst.map((i) => subtractMoney(i.amount, i.paid_amount)));
  const overdue = new Set(installments.filter((i) => i.status === "overdue").map((i) => i.debt_id));
  const sorted = [...active].sort(
    (a, b) =>
      debtPriorityScore({ interest_rate: b.interest_rate, priority: b.priority, overdue: overdue.has(b.id) }) -
      debtPriorityScore({ interest_rate: a.interest_rate, priority: a.priority, overdue: overdue.has(a.id) }),
  );
  const paidOff = debts.filter((d) => d.status === "paid_off");

  return (
    <div>
      <PageHeader title="Dívidas e parcelamentos" description="Empréstimos, financiamentos, acordos e valores emprestados." actions={<NewDebtButton />} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { l: "Total das dívidas", v: formatBRL(total), icon: HandCoins },
          { l: "Total já pago", v: formatBRL(paid), icon: CheckCircle2 },
          { l: "Total restante", v: formatBRL(remaining), icon: Wallet },
          { l: "Parcelas do mês", v: formatBRL(monthAmount), sub: `${monthInst.length} parcela(s)`, icon: AlertTriangle },
          { l: "Quitação", v: `${total ? ((paid / total) * 100).toFixed(0) : 0}%`, icon: PiggyBank, progress: total ? (paid / total) * 100 : 0 },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><k.icon className="size-3.5" />{k.l}</p>
            <p className="mt-1 text-lg font-semibold tabular">{k.v}</p>
            {k.sub && <p className="text-[11.5px] text-muted-foreground">{k.sub}</p>}
            {k.progress !== undefined && <Progress className="mt-2" value={k.progress} tone="positive" />}
          </Card>
        ))}
      </div>

      {sorted.length === 0 && paidOff.length === 0 ? (
        <Card><EmptyState icon={HandCoins} title="Nenhuma dívida cadastrada" description="Cadastre empréstimos, financiamentos ou compras parceladas fora do cartão para acompanhar o saldo devedor." /></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((d, idx) => {
            const pct = debtProgress(d.paid_total, d.total_to_pay);
            return (
              <Link key={d.id} href={`/dividas/${d.id}`}>
                <Card className="group flex flex-col gap-4 p-5 transition hover:shadow-elevated md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{d.name}</p>
                      {idx === 0 && sorted.length > 1 && <Badge variant="negative">Prioritária</Badge>}
                      {overdue.has(d.id) && <Badge variant="negative">Parcela vencida</Badge>}
                      <Badge variant="outline">{DEBT_TYPE_LABEL[d.type]}</Badge>
                      <Badge variant={d.priority === 1 ? "warning" : "neutral"}>Prioridade {PRIORITY_LABEL[d.priority].toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {d.creditor ?? "Credor não informado"} · {d.scope === "shared" ? "Casal" : memberName(ctx, d.owner_id)}
                      {Number(d.interest_rate) > 0 && ` · ${Number(d.interest_rate).toLocaleString("pt-BR")}% a.m.`}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={pct} tone="positive" className="h-2.5" />
                      <span className="w-12 text-right text-[12.5px] font-semibold tabular">{pct.toFixed(0)}%</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      {d.paid_count} de {d.installments_count} parcelas pagas
                      {d.next_due_date && ` · próxima ${formatDate(d.next_due_date)} (${formatBRL(d.next_amount ?? 0)})`}
                      {d.last_due_date && ` · término previsto ${formatDate(d.last_due_date, "MM/yyyy")}`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 md:w-52 md:justify-end">
                    <div className="md:text-right">
                      <p className="text-[12px] text-muted-foreground">Saldo devedor</p>
                      <p className="text-xl font-semibold tabular">{formatBRL(d.outstanding)}</p>
                    </div>
                    <ChevronRight className="size-5 text-subtle-foreground transition group-hover:translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            );
          })}
          {paidOff.length > 0 && (
            <>
              <p className="mt-4 text-[12px] font-medium uppercase tracking-wider text-subtle-foreground">Quitadas 🎉</p>
              {paidOff.map((d) => (
                <Link key={d.id} href={`/dividas/${d.id}`}>
                  <Card className="flex items-center justify-between p-4 opacity-80 hover:opacity-100">
                    <span className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-positive" />{d.name}</span>
                    <span className="text-[12.5px] text-muted-foreground">Quitada em {d.paid_off_at ? formatDate(d.paid_off_at) : "—"} · {formatBRL(d.paid_total)}</span>
                  </Card>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
      <p className="mt-6 text-center text-[12px] text-muted-foreground">Ordem de prioridade sugerida: dívidas com parcelas vencidas e juros mais altos primeiro. Hoje é {formatDate(today)}.</p>
    </div>
  );
}
