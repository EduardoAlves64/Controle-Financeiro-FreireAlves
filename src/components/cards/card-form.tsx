"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useAppData } from "@/components/providers/app-data";
import { OwnerPicker, PrivacyToggle, ScopePicker } from "@/components/forms/form-bits";
import { ColorPicker } from "@/components/forms/color-picker";
import { CardVisual } from "./card-visual";
import { saveCard } from "@/lib/actions/cards";
import { cardSchema } from "@/lib/validation";
import { CARD_BRANDS } from "@/lib/constants";
import type { CreditCard } from "@/lib/types";

export function CardForm({ initial, onDone }: { initial?: CreditCard; onDone: () => void }) {
  const app = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof cardSchema>, unknown, z.output<typeof cardSchema>>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      id: initial?.id,
      name: initial?.name ?? "",
      bank: initial?.bank ?? "",
      brand: (initial?.brand as z.input<typeof cardSchema>["brand"]) ?? "visa",
      last4: initial?.last4 ?? "",
      credit_limit: initial ? Number(initial.credit_limit) : 0,
      closing_day: initial?.closing_day ?? 3,
      due_day: initial?.due_day ?? 10,
      color: initial?.color ?? "#1B2A6B",
      owner_id: initial?.owner_id ?? app.userId,
      scope: initial?.scope ?? "individual",
      visibility: initial?.visibility ?? "household",
    },
  });
  const w = form.watch();
  const e = form.formState.errors;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await saveCard(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          onDone();
          router.refresh();
        }),
      )}
    >
      <CardVisual name={w.name || "Novo cartão"} bank={w.bank} brand={w.brand ?? "visa"} last4={w.last4 || "0000"} color={w.color} holder={app.memberName(w.owner_id)} className="mx-auto max-w-sm" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome do cartão" error={e.name?.message} className="col-span-2"><Input placeholder="Ex.: Cartão do casal" {...form.register("name")} /></Field>
        <Field label="Banco"><Input placeholder="Ex.: Nubank" {...form.register("bank")} /></Field>
        <Field label="Bandeira">
          <Select {...form.register("brand")}>{CARD_BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</Select>
        </Field>
        <Field label="Últimos 4 dígitos" error={e.last4?.message}><Input inputMode="numeric" maxLength={4} {...form.register("last4")} /></Field>
        <Field label="Limite total" error={e.credit_limit?.message}>
          <Controller control={form.control} name="credit_limit" render={({ field }) => <MoneyInput value={Number(field.value)} onChange={field.onChange} />} />
        </Field>
        <Field label="Dia de fechamento" hint="Melhor dia de compra: o próprio dia do fechamento."><Input type="number" min={1} max={31} {...form.register("closing_day")} /></Field>
        <Field label="Dia de vencimento"><Input type="number" min={1} max={31} {...form.register("due_day")} /></Field>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium">Responsável</p>
        <Controller control={form.control} name="owner_id" render={({ field }) => <OwnerPicker value={field.value} onChange={field.onChange} />} />
      </div>
      <Controller control={form.control} name="scope" render={({ field }) => <ScopePicker value={field.value} onChange={field.onChange} />} />
      <Controller control={form.control} name="visibility" render={({ field }) => <PrivacyToggle value={field.value} onChange={field.onChange} />} />
      <Field label="Cor"><Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} /></Field>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="flex-[2]" loading={pending}>{initial ? "Salvar" : "Cadastrar cartão"}</Button>
      </div>
    </form>
  );
}
