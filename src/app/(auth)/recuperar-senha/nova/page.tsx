"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { resetSchema } from "@/lib/validation";
import { updatePassword } from "@/lib/actions/auth";

export default function NewPasswordPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });
  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight">Nova senha</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Use pelo menos 8 caracteres, com letras e números.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((v) =>
          start(async () => {
            const r = await updatePassword(v);
            if (!r.ok) return setError(r.error);
            toast.success(r.message);
            router.replace("/");
          }),
        )}
      >
        <Field label="Nova senha" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        {error && <p className="rounded-xl bg-negative-soft px-4 py-3 text-sm text-negative">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
