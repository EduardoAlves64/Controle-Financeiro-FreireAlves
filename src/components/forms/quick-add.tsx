"use client";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useAppData } from "@/components/providers/app-data";
import { TransactionForm } from "./transaction-form";
import { TransferForm } from "./transfer-form";

export function QuickAdd() {
  const { quickAdd, openQuickAdd, closeQuickAdd } = useAppData();
  const open = quickAdd !== null;

  const title =
    quickAdd?.type === "transaction"
      ? quickAdd.initial?.id && !quickAdd.duplicate
        ? "Editar movimentação"
        : quickAdd.kind === "income"
          ? "Nova receita"
          : "Nova despesa"
      : quickAdd?.type === "transfer"
        ? "Transferência entre contas"
        : "O que você quer registrar?";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeQuickAdd()} title={title}>
      {quickAdd?.type === "chooser" && (
        <div className="grid gap-3 pb-2">
          {[
            { kind: "expense" as const, icon: ArrowUpRight, t: "Nova despesa", d: "Compras, contas, cartão, parcelas", c: "bg-negative-soft text-negative" },
            { kind: "income" as const, icon: ArrowDownLeft, t: "Nova receita", d: "Salário, freelance, vendas, rendimentos", c: "bg-positive-soft text-positive" },
          ].map((o) => (
            <button
              key={o.kind}
              onClick={() => openQuickAdd({ type: "transaction", kind: o.kind })}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition hover:border-border-strong hover:bg-surface-2 active:scale-[0.99]"
            >
              <span className={`flex size-12 items-center justify-center rounded-2xl ${o.c}`}>
                <o.icon className="size-5" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{o.t}</span>
                <span className="block text-[13px] text-muted-foreground">{o.d}</span>
              </span>
            </button>
          ))}
          <button
            onClick={() => openQuickAdd({ type: "transfer" })}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-4 text-left transition hover:bg-surface-2"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <ArrowLeftRight className="size-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">Transferência</span>
              <span className="block text-[13px] text-muted-foreground">Entre contas, sem afetar receitas e despesas</span>
            </span>
          </button>
        </div>
      )}
      {quickAdd?.type === "transaction" && (
        <TransactionForm
          key={`${quickAdd.kind}-${quickAdd.initial?.id ?? "new"}-${quickAdd.duplicate ? "dup" : ""}`}
          kind={quickAdd.kind}
          initial={quickAdd.initial}
          duplicate={quickAdd.duplicate}
          onDone={closeQuickAdd}
        />
      )}
      {quickAdd?.type === "transfer" && <TransferForm onDone={closeQuickAdd} />}
    </Sheet>
  );
}
