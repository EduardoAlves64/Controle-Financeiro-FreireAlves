"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, CheckCircle2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useAppData } from "@/components/providers/app-data";
import { amortizeDebt, cancelDebt, deleteDebt, payDebtInstallment } from "@/lib/actions/debts";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBRL, subtractMoney } from "@/lib/money";
import type { Debt, DebtInstallment } from "@/lib/types";

function AccountSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { accounts } = useAppData();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione</option>
      {accounts.filter((a) => !a.archived_at).map((a) => <option key={a.id} value={a.id}>{a.name} ({formatBRL(a.balance)})</option>)}
    </Select>
  );
}

export function DebtHeaderActions({ debt }: { debt: Debt }) {
  const app = useAppData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ account: app.accounts[0]?.id ?? "", amount: 0, date: todayISO(), strategy: "last" as "last" | "next" });
  const [pending, start] = useTransition();
  return (
    <>
      {debt.status === "active" && <Button onClick={() => setOpen(true)}><Zap /> Amortizar / antecipar</Button>}
      {debt.status === "active" && (
        <ConfirmDialog
          title="Cancelar dívida?"
          description="Use quando a dívida foi renegociada ou perdoada. Os pagamentos já feitos continuam no histórico."
          confirmLabel="Cancelar dívida"
          destructive
          onConfirm={async () => {
            const r = await cancelDebt(debt.id);
            if (r.ok) toast.success(r.message); else toast.error(r.error);
            router.refresh();
          }}
          trigger={<Button variant="outline"><Ban /> Cancelar</Button>}
        />
      )}
      <ConfirmDialog
        title="Excluir dívida definitivamente?"
        description="A dívida, as parcelas e os pagamentos vinculados serão removidos e os saldos recalculados. Prefira cancelar para manter o histórico."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          const r = await deleteDebt(debt.id);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.push("/dividas");
        }}
        trigger={<Button variant="ghost" size="icon" aria-label="Excluir"><Trash2 /></Button>}
      />
      <Sheet open={open} onOpenChange={setOpen} title="Amortização / pagamento antecipado" description={`Saldo devedor: ${formatBRL(debt.outstanding)}`}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await amortizeDebt({ debt_id: debt.id, account_id: v.account, amount: v.amount, date: v.date, strategy: v.strategy });
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <MoneyInput size="xl" value={v.amount} onChange={(amount) => setV({ ...v, amount })} />
          <Field label="Aplicar o valor em">
            <Segmented
              className="w-full"
              value={v.strategy}
              onChange={(strategy) => setV({ ...v, strategy })}
              options={[{ value: "last", label: "Últimas parcelas (reduz prazo)" }, { value: "next", label: "Próximas parcelas" }]}
            />
          </Field>
          <Field label="Conta utilizada"><AccountSelect value={v.account} onChange={(account) => setV({ ...v, account })} /></Field>
          <Field label="Data"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Button type="submit" loading={pending}>Registrar amortização</Button>
        </form>
      </Sheet>
    </>
  );
}

export function InstallmentsTable({ debt, installments }: { debt: Debt; installments: DebtInstallment[] }) {
  const app = useAppData();
  const router = useRouter();
  const [sel, setSel] = useState<DebtInstallment | null>(null);
  const [v, setV] = useState({ account: app.accounts[0]?.id ?? "", amount: 0, date: todayISO() });
  const [pending, start] = useTransition();
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Vencimento</th>
              <th className="px-4 py-2.5 text-right font-medium">Valor</th>
              <th className="px-4 py-2.5 text-right font-medium">Pago</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {installments.map((i) => (
              <tr key={i.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-2.5 tabular text-muted-foreground">{i.number}</td>
                <td className="px-4 py-2.5">{formatDate(i.due_date)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular">{formatBRL(i.amount)}</td>
                <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{Number(i.paid_amount) > 0 ? formatBRL(i.paid_amount) : "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={i.status === "paid" ? "positive" : i.status === "overdue" ? "negative" : Number(i.paid_amount) > 0 ? "warning" : "neutral"}>
                    {i.status === "paid" ? "Paga" : i.status === "overdue" ? "Vencida" : Number(i.paid_amount) > 0 ? "Parcial" : "Pendente"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {i.status !== "paid" && debt.status === "active" && (
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        setV((x) => ({ ...x, amount: subtractMoney(i.amount, i.paid_amount), date: todayISO() }));
                        setSel(i);
                      }}
                    >
                      <CheckCircle2 /> Pagar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel ? `Pagar parcela ${sel.number}/${debt.installments_count}` : ""} description={sel ? `Vencimento ${formatDate(sel.due_date)}` : undefined}>
        {sel && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await payDebtInstallment({ installment_id: sel.id, account_id: v.account, amount: v.amount, date: v.date });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                setSel(null);
                router.refresh();
              });
            }}
          >
            <MoneyInput size="xl" value={v.amount} onChange={(amount) => setV({ ...v, amount })} />
            <Field label="Conta utilizada"><AccountSelect value={v.account} onChange={(account) => setV({ ...v, account })} /></Field>
            <Field label="Data do pagamento"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
            <p className="text-[12px] text-muted-foreground">O pagamento é registrado como despesa na categoria &ldquo;Dívidas e empréstimos&rdquo; e sai da conta escolhida.</p>
            <Button type="submit" loading={pending}>Confirmar pagamento</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
