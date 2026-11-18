"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useAppData } from "@/components/providers/app-data";
import { deleteBudget, saveBudget } from "@/lib/actions/goals";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Budget } from "@/lib/types";

export type BudgetRow = Budget & { spent: number; pct: number };

export function BudgetsManager({ budgets, monthLabel }: { budgets: BudgetRow[]; monthLabel: string }) {
  const app = useAppData();
  const router = useRouter();
  const [edit, setEdit] = useState<{ id?: string; category_id: string; amount: number; alert_threshold: number } | null>(null);
  const [pending, start] = useTransition();
  const used = new Set(budgets.map((b) => b.category_id));
  const expenseCats = app.categories.filter((c) => c.kind === "expense" && !c.archived_at);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Orçamento por categoria</h2>
          <p className="text-[13px] text-muted-foreground">{monthLabel} · alerta em 80% e destaque ao ultrapassar</p>
        </div>
        <Button variant="outline" onClick={() => setEdit({ category_id: expenseCats.find((c) => !used.has(c.id))?.id ?? "", amount: 0, alert_threshold: 80 })}>
          <Plus /> Novo orçamento
        </Button>
      </div>
      {budgets.length === 0 ? (
        <Card><EmptyState icon={Wallet} title="Nenhum orçamento" description="Exemplo: Supermercado R$ 1.200 por mês. Vocês recebem um alerta ao atingir 80%." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {budgets.map((b) => {
            const cat = app.categoryById(b.category_id);
            const over = b.pct > 100;
            const warn = !over && b.pct >= b.alert_threshold;
            return (
              <Card key={b.id} className={cn("p-4", over && "border-negative/40 bg-negative-soft/40")}>
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={cat?.icon} color={cat?.color} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {cat?.name}
                      {(over || warn) && <AlertTriangle className={cn("size-4", over ? "text-negative" : "text-warning")} />}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground tabular">
                      <span className={cn("font-semibold", over ? "text-negative" : "text-foreground")}>{formatBRL(b.spent)}</span> de {formatBRL(b.amount)}
                    </p>
                  </div>
                  <span className={cn("text-[15px] font-semibold tabular", over ? "text-negative" : warn ? "text-warning" : "text-muted-foreground")}>{b.pct.toFixed(0)}%</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEdit({ id: b.id, category_id: b.category_id, amount: Number(b.amount), alert_threshold: b.alert_threshold })}><Pencil /></Button>
                </div>
                <Progress className="mt-3" value={b.pct} tone={over ? "danger" : warn ? "warning" : "default"} />
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {over ? `Ultrapassou em ${formatBRL(b.spent - Number(b.amount))}` : `Ainda pode gastar ${formatBRL(Number(b.amount) - b.spent)}`}
                </p>
              </Card>
            );
          })}
        </div>
      )}
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Editar orçamento" : "Novo orçamento"}>
        {edit && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveBudget(edit);
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                setEdit(null);
                router.refresh();
              });
            }}
          >
            <Field label="Categoria">
              <Select value={edit.category_id} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                {expenseCats.filter((c) => !used.has(c.id) || c.id === edit.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Limite mensal"><MoneyInput size="xl" value={edit.amount} onChange={(amount) => setEdit({ ...edit, amount })} /></Field>
            <Field label="Alertar ao atingir (%)"><Input type="number" min={1} max={100} value={edit.alert_threshold} onChange={(e) => setEdit({ ...edit, alert_threshold: Number(e.target.value) })} /></Field>
            <div className="flex gap-2">
              {edit.id && (
                <Button
                  type="button"
                  variant="danger-ghost"
                  onClick={() =>
                    start(async () => {
                      const r = await deleteBudget(edit.id!);
                      if (r.ok) toast.success(r.message); else toast.error(r.error);
                      setEdit(null);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 /> Remover
                </Button>
              )}
              <Button type="submit" className="flex-1" loading={pending}>Salvar</Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
