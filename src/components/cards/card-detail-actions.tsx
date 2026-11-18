"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Pencil, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useAppData } from "@/components/providers/app-data";
import { CardForm } from "./card-form";
import { archiveCard, payInvoice } from "@/lib/actions/cards";
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import type { CreditCard, Invoice } from "@/lib/types";

export function CardDetailActions({ card }: { card: CreditCard }) {
  const app = useAppData();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <Button onClick={() => app.openQuickAdd({ type: "transaction", kind: "expense", initial: { payment_method: "credit_card", credit_card_id: card.id, scope: card.scope } })}>
        <Plus /> Nova compra
      </Button>
      <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Editar</Button>
      <ConfirmDialog
        title="Arquivar cartão?"
        description="O cartão deixa de aparecer para novas compras. Faturas e histórico são preservados."
        confirmLabel="Arquivar"
        destructive
        onConfirm={async () => {
          const r = await archiveCard(card.id);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.push("/cartoes");
        }}
        trigger={<Button variant="ghost" size="icon" aria-label="Arquivar"><Archive /></Button>}
      />
      <Sheet open={edit} onOpenChange={setEdit} title="Editar cartão">
        {edit && <CardForm initial={card} onDone={() => setEdit(false)} />}
      </Sheet>
    </>
  );
}

export function PayInvoiceButton({ invoice, cardName }: { invoice: Invoice; cardName: string }) {
  const app = useAppData();
  const router = useRouter();
  const remaining = Number(invoice.total) - Number(invoice.paid_amount);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ account: app.accounts.find((a) => a.scope === "shared")?.id ?? app.accounts[0]?.id ?? "", amount: remaining, date: todayISO() });
  const [pending, start] = useTransition();
  if (remaining <= 0) return null;
  return (
    <>
      <Button onClick={() => { setV((x) => ({ ...x, amount: remaining })); setOpen(true); }}><Receipt /> Pagar fatura</Button>
      <Sheet open={open} onOpenChange={setOpen} title={`Pagar fatura · ${cardName}`} description={`Saldo da fatura: ${formatBRL(remaining)}`}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await payInvoice({ invoice_id: invoice.id, account_id: v.account, amount: v.amount, date: v.date });
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <MoneyInput size="xl" value={v.amount} onChange={(amount) => setV({ ...v, amount })} />
          <Field label="Pagar com a conta">
            <Select value={v.account} onChange={(e) => setV({ ...v, account: e.target.value })}>
              {app.accounts.filter((a) => !a.archived_at).map((a) => <option key={a.id} value={a.id}>{a.name} ({formatBRL(a.balance)})</option>)}
            </Select>
          </Field>
          <Field label="Data do pagamento"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground">
            O pagamento sai da conta escolhida, mas não é contado como despesa: as compras desta fatura já foram registradas como despesas nas datas em que aconteceram. Pagamento parcial é permitido.
          </p>
          <Button type="submit" loading={pending}>Confirmar pagamento</Button>
        </form>
      </Sheet>
    </>
  );
}
