"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signUpSchema } from "@/lib/validation";
import { signUp } from "@/lib/actions/auth";

export function SignUpForm({ invite }: { invite?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<z.input<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm: "", invite_code: invite ?? "" },
  });
  const e = form.formState.errors;

  if (sent)
    return (
      <div className="animate-slide-up text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <MailCheck className="size-6" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Confirme seu e-mail</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Enviamos um link de confirmação para <strong className="text-foreground">{form.getValues("email")}</strong>. Depois
          de confirmar, é só entrar.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    );

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight">Criar conta</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Cada pessoa tem seu próprio login. Quem cria primeiro gera o núcleo familiar; o outro entra com o código de convite.
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((v) =>
          start(async () => {
            setError(null);
            const r = await signUp(v);
            if (r && !r.ok) setError(r.error);
            else if (r?.ok) setSent(true);
          }),
        )}
      >
        <Field label="Seu nome" htmlFor="full_name" error={e.full_name?.message}>
          <Input id="full_name" autoComplete="name" placeholder="Como você quer ser chamado(a)" {...form.register("full_name")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Senha" htmlFor="password" error={e.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Field label="Confirmar senha" htmlFor="confirm" error={e.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
          </Field>
        </div>
        <Field
          label="Código de convite (opcional)"
          htmlFor="invite_code"
          hint="Use o código que seu(sua) parceiro(a) encontra em Configurações › Núcleo familiar."
          error={e.invite_code?.message}
        >
          <Input id="invite_code" className="uppercase tracking-widest" placeholder="EX: 7F3A9C21" {...form.register("invite_code")} />
        </Field>
        {error && <p className="rounded-xl bg-negative-soft px-4 py-3 text-sm text-negative" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Criar conta
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
