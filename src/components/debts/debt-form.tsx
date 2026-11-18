"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useAppData } from "@/components/providers/app-data";
import { OwnerPicker, PrivacyToggle, ScopePicker } from "@/components/forms/form-bits";
import { createDebt } from "@/lib/actions/debts";
import { debtSchema } from "@/lib/validation";
import { DEBT_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { pmt } from "@/lib/finance/debt";
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import type { DebtType } from "@/lib/types";

export function DebtForm({ onDone }: { onDone: () => void }) {
  const app = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof debtSchema>, unknown, z.output<typeof debtSchema>>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "", creditor: "", type: "loan", original_amount: 0, interest_rate: 0, installments_count: 12, installment_amount: 0,
      contract_date: todayISO(), first_due_date: todayISO(), paid_installments: 0, priority: 2, owner_id: app.userId,
      scope: "individual", visibility: "household", notes: "",
    },
  });
  const e = form.formState.errors;
  const w = form.watch();
  const suggested = pmt(Number(w.original_amount) || 0, Number(w.interest_rate) || 0, Number(w.installments_count) || 1);
  const totalToPay = (Number(w.installment_amount) || 0) * (Number(w.installments_count) || 0);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await createDebt(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          onDone();
          router.push(`/dividas/${r.data!.id}`);
        }),
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome da dívida" error={e.name?.message} className="col-span-2"><Input placeholder="Ex.: Empréstimo, financiamento do carro..." {...form.register("name")} /></Field>
        <Field label="Credor"><Input placeholder="Banco, loja, pessoa..." {...form.register("creditor")} /></Field>
        <Field label="Tipo">
          <Select {...form.register("type")}>
            {(Object.keys(DEBT_TYPE_LABEL) as DebtType[]).map((t) => <option key={t} value={t}>{DEBT_TYPE_LABEL[t]}</option>)}
          </Select>
        </Field>
        <Field label="Valor original" error={e.original_amount?.message} className="col-span-2">
          <Controller control={form.control} name="original_amount" render={({ field }) => <MoneyInput value={Number(field.value)} onChange={field.onChange} />} />
        </Field>
        <Field label="Juros (% ao mês)" hint="0 para sem juros"><Input type="number" step="0.01" min={0} {...form.register("interest_rate")} /></Field>
        <Field label="Quantidade de parcelas" error={e.installments_count?.message}><Input type="number" min={1} max={600} {...form.register("installments_count")} /></Field>
        <Field label="Valor da parcela" error={e.installment_amount?.message} className="col-span-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Controller control={form.control} name="installment_amount" render={({ field }) => <MoneyInput value={Number(field.value)} onChange={field.onChange} />} />
            </div>
            <Button type="button" variant="outline" onClick={() => form.setValue("installment_amount", suggested)} title="Calcular pela Tabela Price">
              <Calculator /> {formatBRL(suggested)}
            </Button>
          </div>
        </Field>
        <Field label="Data de contratação"><Input type="date" {...form.register("contract_date")} /></Field>
        <Field label="Primeiro vencimento"><Input type="date" {...form.register("first_due_date")} /></Field>
        <Field label="Parcelas já pagas" hint="Antes de usar o app (não afetam saldos)" error={e.paid_installments?.message}><Input type="number" min={0} {...form.register("paid_installments")} /></Field>
        <Field label="Prioridade">
          <Select {...form.register("priority")}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select>
        </Field>
      </div>
      {totalToPay > 0 && (
        <p className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-[12.5px] text-primary">
          Total a pagar: {formatBRL(totalToPay)}
          {Number(w.original_amount) > 0 && totalToPay > Number(w.original_amount) && ` · juros de ${formatBRL(totalToPay - Number(w.original_amount))}`}
        </p>
      )}
      <div>
        <p className="mb-2 text-[13px] font-medium">Responsável</p>
        <Controller control={form.control} name="owner_id" render={({ field }) => <OwnerPicker value={field.value} onChange={field.onChange} />} />
      </div>
      <Controller control={form.control} name="scope" render={({ field }) => <ScopePicker value={field.value} onChange={field.onChange} />} />
      <Controller control={form.control} name="visibility" render={({ field }) => <PrivacyToggle value={field.value} onChange={field.onChange} />} />
      <Field label="Observações"><Textarea rows={2} {...form.register("notes")} /></Field>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="flex-[2]" loading={pending}>Cadastrar dívida</Button>
      </div>
    </form>
  );
}
