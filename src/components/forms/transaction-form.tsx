"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Paperclip } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useAppData } from "@/components/providers/app-data";
import { OwnerPicker, PrivacyToggle, ScopePicker } from "./form-bits";
import { saveTransaction, addAttachment } from "@/lib/actions/transactions";
import { createClient } from "@/lib/supabase/client";
import { transactionSchema } from "@/lib/validation";
import { FREQUENCY_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { formatBRL, splitInstallments } from "@/lib/money";
import type { Frequency, Transaction } from "@/lib/types";

type FormIn = z.input<typeof transactionSchema>;
type FormOut = z.output<typeof transactionSchema>;

export function TransactionForm({
  kind: initialKind,
  initial,
  duplicate,
  onDone,
}: {
  kind: "income" | "expense";
  initial?: Partial<Transaction>;
  duplicate?: boolean;
  onDone: () => void;
}) {
  const app = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = !!initial?.id && !duplicate;
  const isCardEdit = editing && !!initial?.credit_card_id;
  const activeAccounts = app.accounts.filter((a) => !a.archived_at);
  const defaultAccount = activeAccounts.find((a) => a.owner_id === app.userId)?.id ?? activeAccounts[0]?.id ?? "";

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      id: editing ? initial!.id : undefined,
      kind: initial?.kind === "income" ? "income" : initial?.kind === "expense" ? "expense" : initialKind,
      description: initial?.description?.replace(/ \(\d+\/\d+\)$/, "") ?? "",
      amount: initial?.amount ? Number(initial.amount) : 0,
      category_id: initial?.category_id ?? "",
      date: duplicate ? todayISO() : initial?.date ?? todayISO(),
      due_date: initial?.due_date ?? "",
      status: initial?.status ?? "paid",
      account_id: initial?.account_id ?? (initial?.credit_card_id ? "" : defaultAccount),
      credit_card_id: initial?.credit_card_id ?? "",
      payment_method: initial?.payment_method ?? (initialKind === "income" ? "transfer" : "pix"),
      owner_id: initial?.owner_id ?? app.userId,
      scope: initial?.scope ?? (app.perspective === "shared" ? "shared" : "individual"),
      visibility: initial?.visibility ?? "household",
      installments: 1,
      repeat: "none",
      notes: initial?.notes ?? "",
    },
  });
  const { register, control, watch, setValue, formState } = form;
  const e = formState.errors;
  const kind = watch("kind");
  const status = watch("status");
  const method = watch("payment_method");
  const installments = Number(watch("installments") ?? 1);
  const amount = Number(watch("amount") ?? 0);
  const repeat = watch("repeat");
  const isCard = kind === "expense" && method === "credit_card";

  const categories = useMemo(
    () => app.categories.filter((c) => c.kind === kind && (!c.archived_at || c.id === initial?.category_id)),
    [app.categories, kind, initial?.category_id],
  );
  const suggestions = useMemo(() => app.suggestions.filter((s) => s.kind === kind), [app.suggestions, kind]);

  function applySuggestion(desc: string) {
    const s = suggestions.find((x) => x.description.toLowerCase() === desc.trim().toLowerCase());
    if (!s || editing) return;
    if (!form.getValues("category_id") && s.category_id) setValue("category_id", s.category_id);
    if (s.payment_method) setValue("payment_method", s.payment_method as FormIn["payment_method"]);
    if (s.credit_card_id) setValue("credit_card_id", s.credit_card_id);
    if (s.account_id) setValue("account_id", s.account_id);
    setValue("scope", s.scope);
  }

  async function uploadAttachment(transactionId: string) {
    if (!file) return;
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${app.householdId}/${transactionId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
    if (error) return toast.error("A movimentação foi salva, mas o anexo falhou: " + error.message);
    await addAttachment({ transaction_id: transactionId, storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
  }

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const r = await saveTransaction(values);
      if (!r.ok) return void toast.error(r.error);
      if (r.data?.id && file && values.installments === 1 && values.repeat === "none") await uploadAttachment(r.data.id);
      toast.success(r.message);
      onDone();
      router.refresh();
    }),
  );

  const preview = installments > 1 && amount > 0 ? splitInstallments(amount, installments) : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {!editing && (
        <Segmented
          className="w-full"
          value={kind}
          onChange={(v) => {
            setValue("kind", v);
            setValue("category_id", "");
            setValue("payment_method", v === "income" ? "transfer" : "pix");
          }}
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Receita" },
          ]}
        />
      )}

      <Field error={e.amount?.message}>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <MoneyInput
              size="xl"
              autoFocus={!editing}
              disabled={isCardEdit}
              value={Number(field.value) || 0}
              onChange={field.onChange}
              aria-label="Valor"
              className={kind === "income" ? "text-positive" : ""}
            />
          )}
        />
      </Field>

      {isCardEdit && (
        <p className="flex gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Valor, data e cartão de uma compra no cartão não podem ser alterados para manter as faturas corretas. Para
          corrigir, exclua a compra e lance novamente.
        </p>
      )}

      <Field label="Descrição" htmlFor="description" error={e.description?.message}>
        <Input
          id="description"
          list="tx-suggestions"
          placeholder={kind === "income" ? "Ex.: Salário, freelance..." : "Ex.: Supermercado, farmácia..."}
          autoComplete="off"
          {...register("description", { onBlur: (ev) => applySuggestion(ev.target.value) })}
        />
        <datalist id="tx-suggestions">
          {suggestions.map((s) => (
            <option key={s.description} value={s.description} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" htmlFor="category_id" error={e.category_id?.message}>
          <Select id="category_id" {...register("category_id")}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={kind === "income" ? "Data do recebimento" : "Data da compra"} htmlFor="date" error={e.date?.message}>
          <Input id="date" type="date" disabled={isCardEdit} {...register("date")} />
        </Field>
      </div>

      {kind === "expense" && (
        <Field label="Forma de pagamento" error={e.payment_method?.message}>
          <div className="flex flex-wrap gap-1.5">
            {(["pix", "debit", "credit_card", "cash", "bank_slip", "transfer"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={editing && (m === "credit_card") !== !!initial?.credit_card_id}
                onClick={() => {
                  setValue("payment_method", m);
                  if (m === "credit_card") {
                    setValue("status", "paid");
                    setValue("repeat", "none");
                    if (!form.getValues("credit_card_id") && app.cards[0]) setValue("credit_card_id", app.cards[0].id);
                  }
                }}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition disabled:opacity-40 ${
                  method === m ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-2"
                }`}
              >
                {PAYMENT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </Field>
      )}

      {isCard ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Cartão" htmlFor="credit_card_id" error={e.credit_card_id?.message}>
            <Select id="credit_card_id" disabled={isCardEdit} {...register("credit_card_id")}>
              <option value="">Selecione</option>
              {app.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.last4 ? ` •••• ${c.last4}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {!editing && (
            <Field label="Parcelas" htmlFor="installments">
              <Select id="installments" className="w-24" {...register("installments")}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      ) : (
        <>
          <Field label={kind === "income" ? "Conta de destino" : "Conta utilizada"} htmlFor="account_id" error={e.account_id?.message}>
            <Select id="account_id" {...register("account_id")}>
              <option value="">Selecione</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.institution ? ` · ${a.institution}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3">
            <span className="text-[13px] font-medium">{kind === "income" ? "Já foi recebido" : "Já foi pago"}</span>
            <Switch checked={status === "paid"} onCheckedChange={(c) => setValue("status", c ? "paid" : "pending")} />
          </label>
          {status === "pending" && (
            <Field label="Vencimento" htmlFor="due_date" error={e.due_date?.message} hint="Lançamentos pendentes aparecem como previstos e geram alertas.">
              <Input id="due_date" type="date" {...register("due_date")} />
            </Field>
          )}
        </>
      )}

      {!editing && !isCard && kind === "expense" && repeat === "none" && (
        <Field label="Parcelamento (boleto, carnê...)" htmlFor="installments_plain">
          <Select id="installments_plain" {...register("installments")}>
            <option value={1}>À vista</option>
            {Array.from({ length: 47 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} parcelas mensais
              </option>
            ))}
          </Select>
        </Field>
      )}

      {preview && (
        <p className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-[12.5px] text-primary">
          {installments}x de {formatBRL(preview[1])}
          {preview[0] !== preview[1] && ` (1ª de ${formatBRL(preview[0])})`}
          {isCard ? " — a compra conta como despesa uma única vez, na data da compra; as parcelas vão para as faturas." : " — cada parcela vira um lançamento mensal."}
        </p>
      )}

      <div>
        <p className="mb-2 text-[13px] font-medium">Responsável</p>
        <Controller control={control} name="owner_id" render={({ field }) => <OwnerPicker value={field.value} onChange={field.onChange} />} />
      </div>

      <Controller
        control={control}
        name="scope"
        render={({ field }) => <ScopePicker value={field.value} onChange={field.onChange} />}
      />

      <Controller
        control={control}
        name="visibility"
        render={({ field }) => <PrivacyToggle value={field.value} onChange={field.onChange} disabled={isCard} />}
      />

      {!editing && !isCard && installments <= 1 && (
        <Field label="Recorrência" htmlFor="repeat" hint={repeat !== "none" ? "Será criada uma conta fixa com os próximos vencimentos." : undefined}>
          <Select id="repeat" {...register("repeat")}>
            <option value="none">Não se repete</option>
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Observações" htmlFor="notes">
        <Textarea id="notes" rows={2} placeholder="Opcional" {...register("notes")} />
      </Field>

      {!editing && installments <= 1 && repeat === "none" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0] ?? null;
              if (f && f.size > 5 * 1024 * 1024) return void toast.error("O arquivo deve ter no máximo 5 MB");
              setFile(f);
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Paperclip /> {file ? file.name.slice(0, 32) : "Anexar comprovante"}
          </Button>
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-surface px-1 pb-1 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-[2]" loading={pending}>
          {editing ? "Salvar alterações" : kind === "income" ? "Registrar receita" : "Registrar despesa"}
        </Button>
      </div>
    </form>
  );
}
