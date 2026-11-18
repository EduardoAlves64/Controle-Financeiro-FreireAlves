"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useAppData } from "@/components/providers/app-data";
import { OwnerPicker, PrivacyToggle, ScopePicker } from "@/components/forms/form-bits";
import { ColorPicker } from "@/components/forms/color-picker";
import { saveGoal } from "@/lib/actions/goals";
import { goalSchema } from "@/lib/validation";
import type { Goal } from "@/lib/types";

const GOAL_ICONS = ["shield", "plane", "car", "house", "graduation-cap", "hand-coins", "trending-up", "piggy-bank", "gift", "baby", "heart-pulse", "target"];

export function GoalForm({ initial, onDone }: { initial?: Goal; onDone: () => void }) {
  const app = useAppData();
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof goalSchema>, unknown, z.output<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      id: initial?.id,
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      target_amount: initial ? Number(initial.target_amount) : 0,
      target_date: initial?.target_date ?? "",
      icon: initial?.icon ?? "target",
      color: initial?.color ?? "#4969E8",
      owner_id: initial?.owner_id ?? app.userId,
      scope: initial?.scope ?? "shared",
      visibility: initial?.visibility ?? "household",
    },
  });
  const e = form.formState.errors;
  const color = form.watch("color");
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await saveGoal(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          onDone();
          router.refresh();
        }),
      )}
    >
      <Field label="Nome da meta" error={e.name?.message}><Input placeholder="Ex.: Reserva de emergência" {...form.register("name")} /></Field>
      <Field label="Descrição"><Textarea rows={2} placeholder="Opcional" {...form.register("description")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor desejado" error={e.target_amount?.message}>
          <Controller control={form.control} name="target_amount" render={({ field }) => <MoneyInput value={Number(field.value)} onChange={field.onChange} />} />
        </Field>
        <Field label="Prazo"><Input type="date" {...form.register("target_date")} /></Field>
      </div>
      <Field label="Ícone">
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {GOAL_ICONS.map((i) => (
                <button key={i} type="button" onClick={() => field.onChange(i)} className={`rounded-xl p-0.5 ring-2 ${field.value === i ? "ring-primary" : "ring-transparent"}`}>
                  <CategoryIcon icon={i} color={color} />
                </button>
              ))}
            </div>
          )}
        />
      </Field>
      <Field label="Cor"><Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} /></Field>
      <div>
        <p className="mb-2 text-[13px] font-medium">Responsável</p>
        <Controller control={form.control} name="owner_id" render={({ field }) => <OwnerPicker value={field.value} onChange={field.onChange} />} />
      </div>
      <Controller control={form.control} name="scope" render={({ field }) => <ScopePicker value={field.value} onChange={field.onChange} />} />
      <Controller control={form.control} name="visibility" render={({ field }) => <PrivacyToggle value={field.value} onChange={field.onChange} />} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="flex-[2]" loading={pending}>{initial ? "Salvar" : "Criar meta"}</Button>
      </div>
    </form>
  );
}
