"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { useAppData } from "@/components/providers/app-data";
import { OwnerPicker, PrivacyToggle, ScopePicker } from "@/components/forms/form-bits";
import { saveRecurring } from "@/lib/actions/recurring";
import { recurringSchema } from "@/lib/validation";
import { FREQUENCY_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { recurrenceDates } from "@/lib/finance/recurrence";
import type { Frequency, PaymentMethod, RecurringTransaction } from "@/lib/types";

export function RecurringForm({ initial, onDone }: { initial?: RecurringTransaction; onDone: () => void }) {
  const app = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof recurringSchema>, unknown, z.output<typeof recurringSchema>>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      id: initial?.id,
      name: initial?.name ?? "",
      kind: initial?.kind ?? "expense",
      amount: initial ? Number(initial.amount) : 0,
      category_id: initial?.category_id ?? "",
      account_id: initial?.account_id ?? app.accounts.find((a) => a.scope === "shared")?.id ?? app.accounts[0]?.id ?? "",
      payment_method: (initial?.payment_method as Exclude<PaymentMethod, "credit_card">) ?? "pix",
      frequency: initial?.frequency ?? "monthly",
      due_day: initial?.due_day ?? 10,
      start_date: initial?.start_date ?? todayISO().slice(0, 8) + "01",
      end_date: initial?.end_date ?? "",
      owner_id: initial?.owner_id ?? app.userId,
      scope: initial?.scope ?? "shared",
      visibility: initial?.visibility ?? "household",
      notes: initial?.notes ?? "",
    },
  });
  const e = form.formState.errors;
  const w = form.watch();
  const kind = w.kind;
  let preview: string[] = [];
  try {
    if (w.start_date && /^\d{4}-\d{2}-\d{2}$/.test(w.start_date))
      preview = recurrenceDates(w.frequency as Frequency, w.start_date, Number(w.due_day) || 1, todayISO(), toISODate(addMonths(parseISODate(todayISO()), 13))).slice(0, 4);
  } catch {}

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await saveRecurring(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          onDone();
          router.refresh();
        }),
      )}
    >
      {!initial && (
        <Segmented
          className="w-full"
          value={kind}
          onChange={(v) => { form.setValue("kind", v); form.setValue("category_id", ""); }}
          options={[{ value: "expense", label: "Conta a pagar" }, { value: "income", label: "Receita recorrente" }]}
        />
      )}
      <Field error={e.amount?.message}>
        <Controller control={form.control} name="amount" render={({ field }) => <MoneyInput size="xl" value={Number(field.value)} onChange={field.onChange} />} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" htmlFor="name" error={e.name?.message} className="col-span-2">
          <Input id="name" placeholder={kind === "income" ? "Ex.: Salário" : "Ex.: Aluguel, energia, internet..."} {...form.register("name")} />
        </Field>
        <Field label="Categoria">
          <Select {...form.register("category_id")}>
            <option value="">Sem categoria</option>
            {app.categories.filter((c) => c.kind === kind && !c.archived_at).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Frequência">
          <Select {...form.register("frequency")}>
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
              <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
            ))}
          </Select>
        </Field>
        {!["weekly", "biweekly"].includes(w.frequency as string) && (
          <Field label="Dia do vencimento" error={e.due_day?.message}>
            <Input type="number" min={1} max={31} {...form.register("due_day")} />
          </Field>
        )}
        <Field label="Data inicial" error={e.start_date?.message}>
          <Input type="date" {...form.register("start_date")} />
        </Field>
        <Field label="Data final (opcional)" error={e.end_date?.message}>
          <Input type="date" {...form.register("end_date")} />
        </Field>
        <Field label={kind === "income" ? "Conta de destino" : "Conta de pagamento"}>
          <Select {...form.register("account_id")}>
            <option value="">Definir ao pagar</option>
            {app.accounts.filter((a) => !a.archived_at).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Forma de pagamento">
          <Select {...form.register("payment_method")}>
            {(["pix", "debit", "bank_slip", "transfer", "cash", "other"] as const).map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
            ))}
          </Select>
        </Field>
      </div>
      {preview.length > 0 && (
        <div className="rounded-xl bg-primary-soft px-3.5 py-3 text-[12.5px] text-primary">
          Próximos vencimentos: {preview.map((d) => formatDate(d, "dd/MM/yy")).join(" · ")}
        </div>
      )}
      <div>
        <p className="mb-2 text-[13px] font-medium">Responsável</p>
        <Controller control={form.control} name="owner_id" render={({ field }) => <OwnerPicker value={field.value} onChange={field.onChange} />} />
      </div>
      <Controller control={form.control} name="scope" render={({ field }) => <ScopePicker value={field.value} onChange={field.onChange} />} />
      <Controller control={form.control} name="visibility" render={({ field }) => <PrivacyToggle value={field.value} onChange={field.onChange} />} />
      <Field label="Observações">
        <Textarea rows={2} {...form.register("notes")} />
      </Field>
      {initial && <p className="text-[12px] text-muted-foreground">Alterar o valor atualiza as próximas ocorrências ainda não pagas. O histórico pago é preservado.</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="flex-[2]" loading={pending}>{initial ? "Salvar" : "Criar conta fixa"}</Button>
      </div>
    </form>
  );
}
