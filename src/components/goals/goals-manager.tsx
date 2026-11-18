"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CheckCircle2, History, Minus, MoreHorizontal, Pencil, Plus, Target, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ConfirmDialog } from "@/components/ui/confirm";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useAppData } from "@/components/providers/app-data";
import { GoalForm } from "./goal-form";
import { addContribution, deleteContribution, deleteGoal, setGoalStatus } from "@/lib/actions/goals";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { GoalProjection } from "@/lib/finance/goals";
import type { Goal, GoalContribution } from "@/lib/types";

export type GoalRow = Goal & { p: GoalProjection; contributions: GoalContribution[] };
type Mode = { t: "new" } | { t: "edit"; g: Goal } | { t: "contrib"; g: GoalRow; sign: 1 | -1 } | { t: "history"; g: GoalRow } | null;

export function GoalsManager({ goals }: { goals: GoalRow[] }) {
  const app = useAppData();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [v, setV] = useState({ amount: 0, date: todayISO(), note: "" });
  const [pending, start] = useTransition();
  const close = () => setMode(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      after?.();
      router.refresh();
    });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Metas financeiras</h2>
        <Button onClick={() => setMode({ t: "new" })}><Plus /> Nova meta</Button>
      </div>
      {goals.length === 0 ? (
        <Card><EmptyState icon={Target} title="Nenhuma meta ainda" description="Reserva de emergência, viagem, carro, casa... Defina objetivos e acompanhe o progresso juntos." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const done = g.p.percent >= 100;
            return (
              <Card key={g.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CategoryIcon icon={g.icon} color={g.color} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{g.name}</p>
                      <p className="truncate text-[12.5px] text-muted-foreground">{g.description ?? (g.scope === "shared" ? "Meta do casal" : `Meta de ${app.memberName(g.owner_id)}`)}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Ações"><MoreHorizontal /></Button></DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onSelect={() => setMode({ t: "edit", g })}><Pencil /> Editar</DropdownItem>
                      <DropdownItem onSelect={() => setMode({ t: "history", g })}><History /> Histórico de aportes</DropdownItem>
                      {g.status === "active" && <DropdownItem onSelect={() => run(() => setGoalStatus(g.id, "completed"))}><CheckCircle2 /> Marcar como concluída</DropdownItem>}
                      <DropdownItem onSelect={() => run(() => setGoalStatus(g.id, "archived"))}><Archive /> Arquivar</DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem destructive onSelect={() => run(() => deleteGoal(g.id))}><Trash2 /> Excluir</DropdownItem>
                    </DropdownContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight tabular">{formatBRL(g.p.saved)}</p>
                    <p className="text-[12px] text-muted-foreground">de {formatBRL(g.target_amount)}</p>
                  </div>
                  <p className="text-xl font-semibold tabular" style={{ color: g.color }}>{g.p.percent.toFixed(0)}%</p>
                </div>
                <Progress className="mt-3 h-2.5" value={g.p.percent} color={g.color} />

                <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-xl bg-surface-2 px-3 py-2"><dt className="text-muted-foreground">Falta</dt><dd className="font-semibold tabular">{formatBRL(g.p.remaining)}</dd></div>
                  <div className="rounded-xl bg-surface-2 px-3 py-2">
                    <dt className="text-muted-foreground">Por mês</dt>
                    <dd className="font-semibold tabular">{g.p.monthlyNeeded === null ? "Sem prazo" : formatBRL(g.p.monthlyNeeded)}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2 px-3 py-2"><dt className="text-muted-foreground">Prazo</dt><dd className="font-semibold">{g.target_date ? formatDate(g.target_date, "MM/yyyy") : "—"}</dd></div>
                  <div className="rounded-xl bg-surface-2 px-3 py-2">
                    <dt className="text-muted-foreground">Previsão</dt>
                    <dd className="font-semibold">{done ? "Concluída" : g.p.forecastDate ? formatDate(g.p.forecastDate, "MM/yyyy") : "Sem aportes recentes"}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center gap-2">
                  {done ? (
                    <Badge variant="positive" className="py-1"><Trophy /> Meta atingida</Badge>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => { setV({ amount: g.p.monthlyNeeded ?? 0, date: todayISO(), note: "" }); setMode({ t: "contrib", g, sign: 1 }); }}>
                      <Plus /> Aportar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setV({ amount: 0, date: todayISO(), note: "" }); setMode({ t: "contrib", g, sign: -1 }); }}>
                    <Minus /> Resgatar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={mode?.t === "new" || mode?.t === "edit"} onOpenChange={(o) => !o && close()} title={mode?.t === "edit" ? "Editar meta" : "Nova meta"}>
        {(mode?.t === "new" || mode?.t === "edit") && <GoalForm initial={mode.t === "edit" ? mode.g : undefined} onDone={close} />}
      </Sheet>
      <Sheet open={mode?.t === "contrib"} onOpenChange={(o) => !o && close()} title={mode?.t === "contrib" ? `${mode.sign > 0 ? "Aporte" : "Resgate"} · ${mode.g.name}` : ""}>
        {mode?.t === "contrib" && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addContribution({ goal_id: mode.g.id, amount: mode.sign * v.amount, date: v.date, note: v.note }), close);
            }}
          >
            <MoneyInput size="xl" value={v.amount} onChange={(amount) => setV({ ...v, amount })} />
            <Field label="Data"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
            <Field label="Observação"><Input value={v.note} placeholder="Opcional" onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
            <p className="text-[12px] text-muted-foreground">Aportes registram o valor guardado para a meta. Para mover dinheiro entre contas, use também uma transferência.</p>
            <Button type="submit" loading={pending}>Confirmar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={mode?.t === "history"} onOpenChange={(o) => !o && close()} title={mode?.t === "history" ? `Aportes · ${mode.g.name}` : ""}>
        {mode?.t === "history" && (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {mode.g.contributions.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum aporte.</li>}
            {[...mode.g.contributions].reverse().map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px]">
                <span>
                  {formatDate(c.date)}
                  {c.note && <span className="block text-[12px] text-muted-foreground">{c.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`font-semibold tabular ${Number(c.amount) < 0 ? "text-negative" : "text-positive"}`}>{formatBRL(c.amount, { signed: true })}</span>
                  <ConfirmDialog
                    title="Remover este movimento?"
                    destructive
                    confirmLabel="Remover"
                    onConfirm={() => run(() => deleteContribution(c.id), close)}
                    trigger={<Button variant="ghost" size="icon-sm" aria-label="Remover"><Trash2 /></Button>}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
