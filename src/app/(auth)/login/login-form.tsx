"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signInSchema } from "@/lib/validation";
import { signIn } from "@/lib/actions/auth";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Entre para acompanhar as finanças da família.</p>
      {notice && <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted-foreground">{notice}</p>}

      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((v) =>
          start(async () => {
            setError(null);
            const r = await signIn(v, next);
            if (r && !r.ok) setError(r.error);
          }),
        )}
      >
        <Field label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="voce@email.com" {...form.register("email")} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Senha
              <Link href="/recuperar-senha" className="text-xs font-normal text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </span>
          }
          htmlFor="password"
          error={form.formState.errors.password?.message}
        >
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" className="pr-11" {...form.register("password")} />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2"
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        {error && <p className="rounded-xl bg-negative-soft px-4 py-3 text-sm text-negative" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Entrar
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
