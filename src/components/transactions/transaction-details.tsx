"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Select } from "@/components/ui/input";
import { useAppData } from "@/components/providers/app-data";
import { deleteTransaction, getAttachmentUrl, markTransactionPaid } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Transaction } from "@/lib/types";

export function TransactionDetails({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const app = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [payAccount, setPayAccount] = useState("");
  const [files, setFiles] = useState<{ storage_path: string; file_name: string }[]>([]);

  useEffect(() => {
    setFiles([]);
    if (!tx) return;
    setPayAccount(tx.account_id ?? app.accounts[0]?.id ?? "");
    const supabase = createClient();
    supabase
      .from("attachments")
      .select("storage_path, file_name")
      .eq("transaction_id", tx.id)
      .then(({ data }) => setFiles(data ?? []));
  }, [tx, app.accounts]);

  if (!tx) return <Sheet open={false} onOpenChange={() => {}} title="">{null}</Sheet>;
  const cat = app.categoryById(tx.category_id);
  const editable = tx.kind === "income" || tx.kind === "expense";
  const linked = tx.debt_id ? "Pagamento de dívida" : tx.recurring_instance_id ? "Conta fixa" : tx.kind === "invoice_payment" ? "Pagamento de fatura" : null;
  const rows: [string, React.ReactNode][] = [
    ["Data", formatDate(tx.date)],
    ...(tx.due_date ? [["Vencimento", formatDate(tx.due_date)] as [string, React.ReactNode]] : []),
    ["Status", tx.status === "paid" ? <Badge variant="positive">Realizado</Badge> : <Badge variant="warning">Previsto</Badge>],
    ["Categoria", cat?.name ?? "—"],
    [
      tx.credit_card_id ? "Cartão" : "Conta",
      tx.credit_card_id ? app.cards.find((c) => c.id === tx.credit_card_id)?.name ?? "—" : app.accounts.find((a) => a.id === tx.account_id)?.name ?? "—",
    ],
    ["Forma de pagamento", tx.payment_method ? PAYMENT_METHOD_LABEL[tx.payment_method] : "—"],
    ["Responsável", app.memberName(tx.owner_id)],
    ["Tipo", tx.scope === "shared" ? "Compartilhada (casal)" : "Individual"],
    ["Visibilidade", tx.visibility === "private" ? "Privada" : "Família"],
    ...(tx.installment_total ? [["Parcela", `${tx.installment_number}/${tx.installment_total}`] as [string, React.ReactNode]] : []),
    ...(linked ? [["Origem", linked] as [string, React.ReactNode]] : []),
  ];

  return (
    <Sheet
      open={!!tx}
      onOpenChange={(o) => !o && onClose()}
      title="Detalhes"
      footer={
        <div className="flex flex-wrap gap-2">
          {editable && !tx.debt_id && (
            <>
              <Button variant="outline" size="sm" onClick={() => { onClose(); app.openQuickAdd({ type: "transaction", kind: tx.kind as "income" | "expense", initial: tx }); }}>
                <Pencil /> Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => { onClose(); app.openQuickAdd({ type: "transaction", kind: tx.kind as "income" | "expense", initial: { ...tx, id: undefined as unknown as string }, duplicate: true }); }}>
                <Copy /> Duplicar
              </Button>
            </>
          )}
          <ConfirmDialog
            title={tx.credit_card_id ? "Estornar compra no cartão?" : "Excluir movimentação?"}
            description={
              tx.credit_card_id
                ? "A compra e todas as parcelas serão retiradas das faturas. O histórico fica registrado na auditoria."
                : tx.recurring_instance_id
                  ? "A conta fixa voltará a ficar pendente. O histórico fica registrado na auditoria."
                  : "O saldo das contas será recalculado. O histórico fica registrado na auditoria."
            }
            confirmLabel={tx.credit_card_id ? "Estornar" : "Excluir"}
            destructive
            onConfirm={async () => {
              const r = await deleteTransaction(tx.id);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              onClose();
              router.refresh();
            }}
            trigger={
              <Button variant="danger-ghost" size="sm" className="ml-auto">
                <Trash2 /> {tx.credit_card_id ? "Estornar" : "Excluir"}
              </Button>
            }
          />
        </div>
      }
    >
      <div className="flex items-center gap-3">
        <CategoryIcon icon={tx.kind === "invoice_payment" ? "receipt" : cat?.icon} color={cat?.color} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{tx.description}</p>
          <p className={`text-2xl font-semibold tracking-tight tabular ${tx.kind === "income" ? "text-positive" : ""}`}>
            {tx.kind === "income" ? "+" : tx.kind === "adjustment" ? "" : "-"}
            {formatBRL(tx.kind === "adjustment" ? tx.amount : Math.abs(Number(tx.amount)))}
          </p>
        </div>
      </div>

      {tx.status === "pending" && (
        <div className="mt-5 rounded-2xl border border-warning/30 bg-warning-soft p-3.5">
          <p className="text-[13px] font-medium">Este lançamento ainda está previsto.</p>
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                {app.accounts.filter((a) => !a.archived_at).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await markTransactionPaid(tx.id, payAccount);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message);
                  onClose();
                  router.refresh();
                })
              }
            >
              <CheckCircle2 /> {tx.kind === "income" ? "Recebido" : "Pago"}
            </Button>
          </div>
        </div>
      )}

      <dl className="mt-6 divide-y divide-border rounded-2xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 text-[13.5px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {tx.notes && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 text-[13.5px] text-muted-foreground">{tx.notes}</p>}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f) => (
            <button
              key={f.storage_path}
              className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:bg-surface-2"
              onClick={async () => {
                const r = await getAttachmentUrl(f.storage_path);
                if (r.ok && r.data) window.open(r.data.url, "_blank", "noopener");
                else if (!r.ok) toast.error(r.error);
              }}
            >
              <FileText className="size-4 text-muted-foreground" /> {f.file_name}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
