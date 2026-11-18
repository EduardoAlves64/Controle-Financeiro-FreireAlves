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
import { Switch } from "@/components/ui/switch";
import { useAppData } from "@/components/providers/app-data";
import { OwnerPicker, PrivacyToggle, ScopePicker } from "@/components/forms/form-bits";
import { ColorPicker } from "@/components/forms/color-picker";
import { saveAccount } from "@/lib/actions/accounts";
import { accountSchema } from "@/lib/validation";
import { ACCOUNT_TYPE_LABEL } from "@/lib/constants";
import type { Account, AccountType } from "@/lib/types";

export function AccountForm({ initial, onDone }: { initial?: Account; onDone: () => void }) {
  const { userId } = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof accountSchema>, unknown, z.output<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      id: initial?.id,
      name: initial?.name ?? "",
      institution: initial?.institution ?? "",
      type: initial?.type ?? "checking",
      initial_balance: initial ? Number(initial.initial_balance) : 0,
      color: initial?.color ?? "#4969E8",
      owner_id: initial?.owner_id ?? userId,
      scope: initial?.scope ?? "individual",
      visibility: initial?.visibility ?? "household",
      include_in_total: initial?.include_in_total ?? true,
    },
  });
  const e = form.formState.errors;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await saveAccount(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          onDone();
          router.refresh();
        }),
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" htmlFor="name" error={e.name?.message} className="col-span-2">
          <Input id="name" placeholder="Ex.: Conta conjunta" {...form.register("name")} />
        </Field>
        <Field label="Instituição" htmlFor="institution">
          <Input id="institution" placeholder="Ex.: Nubank" {...form.register("institution")} />
        </Field>
        <Field label="Tipo" htmlFor="type">
          <Select id="type" {...form.register("type")}>
            {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => (
              <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Saldo inicial" hint={initial ? "Alterar o saldo inicial recalcula o saldo atual. Para corrigir diferenças, prefira a conciliação." : "Saldo da conta no dia em que você começar a usar o app."}>
        <Controller control={form.control} name="initial_balance" render={({ field }) => <MoneyInput allowNegative value={Number(field.value)} onChange={field.onChange} />} />
      </Field>
      <div>
        <p className="mb-2 text-[13px] font-medium">Responsável</p>
        <Controller control={form.control} name="owner_id" render={({ field }) => <OwnerPicker value={field.value} onChange={field.onChange} />} />
      </div>
      <Controller control={form.control} name="scope" render={({ field }) => <ScopePicker value={field.value} onChange={field.onChange} />} />
      <Controller control={form.control} name="visibility" render={({ field }) => <PrivacyToggle value={field.value} onChange={field.onChange} />} />
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <span>
          <span className="block text-[13px] font-medium">Incluir no saldo disponível</span>
          <span className="block text-[11.5px] text-muted-foreground">Investimentos ficam sempre separados no total investido</span>
        </span>
        <Controller control={form.control} name="include_in_total" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />} />
      </label>
      <Field label="Cor">
        <Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="flex-[2]" loading={pending}>{initial ? "Salvar" : "Criar conta"}</Button>
      </div>
    </form>
  );
}
