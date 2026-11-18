"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarClock, CalendarPlus, CheckCircle2, History, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, SkipForward, XCircle, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Segmented } from "@/components/ui/segmented";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm";
import { CategoryIcon } from "@/components/ui/category-icon";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useAppData } from "@/components/providers/app-data";
import { RecurringForm } from "./recurring-form";
import { cancelRecurring, payInstance, postponeInstance, setRecurringStatus, skipInstance, updateInstanceAmount } from "@/lib/actions/recurring";
import { FREQUENCY_LABEL } from "@/lib/constants";
import { daysUntil, formatDate, relativeDue, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { RecurringInstance, RecurringTransaction } from "@/lib/types";

type Mode =
  | { t: "new" }
  | { t: "edit"; r: RecurringTransaction }
  | { t: "pay"; i: RecurringInstance; r: RecurringTransaction }
  | { t: "postpone"; i: RecurringInstance; r: RecurringTransaction }
  | { t: "amount"; i: RecurringInstance; r: RecurringTransaction }
  | { t: "history"; r: RecurringTransaction }
  | null;

export function RecurringManager({
  recurring,
  instances,
  history,
}: {
  recurring: RecurringTransaction[];
  instances: RecurringInstance[];
  history: RecurringInstance[];
}) {
  const app = useAppData();
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "all">("upcoming");
  const [mode, setMode] = useState<Mode>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ account: "", amount: 0, date: todayISO() });
  const close = () => setMode(null);
  const byId = new Map(recurring.map((r) => [r.id, r]));
  const today = todayISO();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      close();
      router.refresh();
    });

  const upcoming = instances.filter((i) => i.status === "pending" && byId.has(i.recurring_id));
  const nextOf = (id: string) => instances.find((i) => i.recurring_id === id && i.status === "pending");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "upcoming", label: `A pagar (${upcoming.length})` }, { value: "all", label: `Cadastradas (${recurring.length})` }]} />
        <Button onClick={() => setMode({ t: "new" })}><Plus /> Nova conta fixa</Button>
      </div>

      {tab === "upcoming" ? (
        <Card className="p-2 md:p-3">
          {upcoming.length ? (
            upcoming.map((i) => {
              const r = byId.get(i.recurring_id)!;
              const cat = app.categoryById(r.category_id);
              const overdue = i.due_date < today;
              const soon = !overdue && daysUntil(i.due_date) <= 3;
              return (
                <div key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-2 md:px-3">
                  <CategoryIcon icon={cat?.icon ?? "repeat"} color={cat?.color ?? "#4969E8"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {r.name}
                      {r.kind === "income" && <Badge variant="positive" className="ml-2">Receita</Badge>}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {formatDate(i.due_date)}
                      {i.due_date !== i.original_due_date && " (adiada)"} · {r.scope === "shared" ? "Casal" : app.memberName(r.owner_id)}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[14px] font-semibold tabular">{formatBRL(i.amount)}</p>
                    <p className={cn("text-[11.5px]", overdue ? "text-negative" : soon ? "text-warning" : "text-muted-foreground")}>{relativeDue(i.due_date)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={overdue ? "danger" : "soft"}
                    onClick={() => {
                      setForm({ account: r.account_id ?? app.accounts[0]?.id ?? "", amount: Number(i.amount), date: todayISO() });
                      setMode({ t: "pay", i, r });
                    }}
                  >
                    <CheckCircle2 /> <span className="hidden sm:inline">{r.kind === "income" ? "Recebi" : "Pagar"}</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Mais ações"><MoreHorizontal /></Button></DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onSelect={() => { setForm({ ...form, date: i.due_date }); setMode({ t: "postpone", i, r }); }}><CalendarPlus /> Adiar vencimento</DropdownItem>
                      <DropdownItem onSelect={() => { setForm({ ...form, amount: Number(i.amount) }); setMode({ t: "amount", i, r }); }}><Coins /> Alterar valor desta vez</DropdownItem>
                      <DropdownItem onSelect={() => run(() => skipInstance(i.id))}><SkipForward /> Ignorar esta ocorrência</DropdownItem>
                    </DropdownContent>
                  </DropdownMenu>
                </div>
              );
            })
          ) : (
            <EmptyState icon={CalendarClock} title="Nada a pagar por enquanto" description="As ocorrências das contas fixas são geradas automaticamente para os próximos 60 dias." />
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {recurring.length === 0 && (
            <Card className="md:col-span-2"><EmptyState icon={Repeat} title="Nenhuma conta fixa" description="Cadastre aluguel, energia, internet, assinaturas e também receitas recorrentes como salário." /></Card>
          )}
          {recurring.map((r) => {
            const cat = app.categoryById(r.category_id);
            const next = nextOf(r.id);
            return (
              <Card key={r.id} className={cn("p-4", r.status !== "active" && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <CategoryIcon icon={cat?.icon ?? "repeat"} color={cat?.color ?? "#4969E8"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {FREQUENCY_LABEL[r.frequency]}
                      {!["weekly", "biweekly"].includes(r.frequency) && ` · dia ${r.due_day}`}
                      {r.end_date && ` · até ${formatDate(r.end_date, "MM/yyyy")}`}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Ações"><MoreHorizontal /></Button></DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onSelect={() => setMode({ t: "edit", r })}><Pencil /> Editar / alterar valor</DropdownItem>
                      <DropdownItem onSelect={() => setMode({ t: "history", r })}><History /> Histórico</DropdownItem>
                      {r.status === "active" && <DropdownItem onSelect={() => run(() => setRecurringStatus(r.id, "paused"))}><Pause /> Pausar</DropdownItem>}
                      {r.status === "paused" && <DropdownItem onSelect={() => run(() => setRecurringStatus(r.id, "active"))}><Play /> Retomar</DropdownItem>}
                      {r.status !== "canceled" && (
                        <>
                          <DropdownSeparator />
                          <ConfirmDialog
                            title={`Cancelar "${r.name}"?`}
                            description="As próximas ocorrências pendentes serão removidas. O histórico de pagamentos é preservado."
                            destructive
                            confirmLabel="Cancelar conta"
                            onConfirm={() => run(() => cancelRecurring(r.id))}
                            trigger={<button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-negative hover:bg-negative-soft"><XCircle className="size-4" /> Cancelar conta</button>}
                          />
                        </>
                      )}
                    </DropdownContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className={cn("text-xl font-semibold tabular", r.kind === "income" && "text-positive")}>{formatBRL(r.amount)}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {r.status === "active" && next ? `Próximo: ${formatDate(next.due_date)}` : r.status === "paused" ? "Pausada" : r.status === "canceled" ? "Cancelada" : "Sem próximos vencimentos"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={r.scope === "shared" ? "primary" : "neutral"}>{r.scope === "shared" ? "Casal" : app.memberName(r.owner_id)}</Badge>
                    {r.status !== "active" && <Badge variant={r.status === "paused" ? "warning" : "negative"}>{r.status === "paused" ? "Pausada" : "Cancelada"}</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={mode?.t === "new" || mode?.t === "edit"} onOpenChange={(o) => !o && close()} title={mode?.t === "edit" ? "Editar conta fixa" : "Nova conta fixa"}>
        {(mode?.t === "new" || mode?.t === "edit") && <RecurringForm initial={mode.t === "edit" ? mode.r : undefined} onDone={close} />}
      </Sheet>

      <Sheet open={mode?.t === "pay"} onOpenChange={(o) => !o && close()} title={mode?.t === "pay" ? `${mode.r.kind === "income" ? "Receber" : "Pagar"} ${mode.r.name}` : ""} description={mode?.t === "pay" ? `Vencimento em ${formatDate(mode.i.due_date)}` : undefined}>
        {mode?.t === "pay" && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); run(() => payInstance({ instance_id: mode.i.id, account_id: form.account, amount: form.amount, date: form.date })); }}>
            <MoneyInput size="xl" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
            <Field label={mode.r.kind === "income" ? "Conta que recebeu" : "Conta utilizada"}>
              <Select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>
                <option value="">Selecione</option>
                {app.accounts.filter((a) => !a.archived_at).map((a) => <option key={a.id} value={a.id}>{a.name} ({formatBRL(a.balance)})</option>)}
              </Select>
            </Field>
            <Field label="Data do pagamento"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Button type="submit" loading={pending}>Confirmar</Button>
          </form>
        )}
      </Sheet>

      <Sheet open={mode?.t === "postpone"} onOpenChange={(o) => !o && close()} title="Adiar vencimento">
        {mode?.t === "postpone" && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); run(() => postponeInstance(mode.i.id, form.date)); }}>
            <Field label="Nova data de vencimento" hint="A ocorrência original não é duplicada."><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Button type="submit" loading={pending}>Adiar</Button>
          </form>
        )}
      </Sheet>

      <Sheet open={mode?.t === "amount"} onOpenChange={(o) => !o && close()} title="Alterar valor desta ocorrência" description="Para mudar o valor de todas as próximas, edite a conta fixa.">
        {mode?.t === "amount" && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); run(() => updateInstanceAmount(mode.i.id, form.amount)); }}>
            <MoneyInput size="xl" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
            <Button type="submit" loading={pending}>Salvar</Button>
          </form>
        )}
      </Sheet>

      <Sheet open={mode?.t === "history"} onOpenChange={(o) => !o && close()} title={mode?.t === "history" ? `Histórico · ${mode.r.name}` : ""}>
        {mode?.t === "history" && (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {history.filter((h) => h.recurring_id === mode.r.id).sort((a, b) => b.due_date.localeCompare(a.due_date)).map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3 text-[13.5px]">
                <span>{formatDate(h.due_date)}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium tabular">{formatBRL(h.amount)}</span>
                  <Badge variant={h.status === "paid" ? "positive" : h.status === "skipped" ? "neutral" : h.due_date < today ? "negative" : "warning"}>
                    {h.status === "paid" ? `Pago ${h.paid_at ? formatDate(h.paid_at, "dd/MM") : ""}` : h.status === "skipped" ? "Ignorada" : h.due_date < today ? "Vencida" : "Pendente"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
