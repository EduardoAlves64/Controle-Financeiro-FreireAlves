"use client";
import { ArrowLeftRight, Clock, CreditCard, Lock, Receipt, Repeat } from "lucide-react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useAppData } from "@/components/providers/app-data";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export function TransactionRow({
  tx,
  onClick,
  showDate = true,
  className,
}: {
  tx: Transaction;
  onClick?: () => void;
  showDate?: boolean;
  className?: string;
}) {
  const { categoryById, memberName, accounts, cards, members } = useAppData();
  const cat = categoryById(tx.category_id);
  const isIncome = tx.kind === "income";
  const isInvoice = tx.kind === "invoice_payment";
  const isAdj = tx.kind === "adjustment";
  const source = tx.credit_card_id
    ? cards.find((c) => c.id === tx.credit_card_id)?.name
    : accounts.find((a) => a.id === tx.account_id)?.name;
  const sign = isIncome || (isAdj && Number(tx.amount) > 0) ? 1 : -1;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2 md:px-3",
        className,
      )}
    >
      {isInvoice ? (
        <CategoryIcon icon="receipt" color="#64748B" />
      ) : isAdj ? (
        <CategoryIcon icon="transfer" color="#64748B" />
      ) : (
        <CategoryIcon icon={cat?.icon} color={cat?.color} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[14px] font-medium">
          <span className="truncate">{tx.description}</span>
          {tx.visibility === "private" && <Lock className="size-3 shrink-0 text-subtle-foreground" />}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
          {tx.credit_card_id && <CreditCard className="size-3 shrink-0" />}
          {tx.recurring_instance_id && <Repeat className="size-3 shrink-0" />}
          {isInvoice && <Receipt className="size-3 shrink-0" />}
          {isAdj && <ArrowLeftRight className="size-3 shrink-0" />}
          <span className="truncate">
            {isInvoice ? "Pagamento de fatura" : isAdj ? "Ajuste de saldo" : cat?.name ?? "Sem categoria"}
            {source ? ` · ${source}` : ""}
            {members.length > 1 ? ` · ${memberName(tx.owner_id)}` : ""}
          </span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-[14px] font-semibold tabular", sign > 0 ? "text-positive" : isInvoice ? "text-muted-foreground" : "text-foreground")}>
          {sign > 0 ? "+" : "-"}
          {formatBRL(Math.abs(Number(tx.amount)))}
        </p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11.5px] text-muted-foreground">
          {tx.status === "pending" && (
            <span className="inline-flex items-center gap-0.5 text-warning">
              <Clock className="size-3" /> Previsto ·
            </span>
          )}
          {showDate && formatDate(tx.status === "pending" && tx.due_date ? tx.due_date : tx.date, "dd MMM")}
          {tx.scope === "shared" && <span className="ml-1 rounded bg-primary-soft px-1 text-[10px] font-medium text-primary">casal</span>}
        </p>
      </div>
    </button>
  );
}
