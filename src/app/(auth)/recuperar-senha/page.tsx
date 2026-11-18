"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="animate-slide-up">
      <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <h2 className="text-2xl font-semibold tracking-tight">Recuperar senha</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Enviaremos um link seguro para você criar uma nova senha.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await requestPasswordReset(email);
            setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
          });
        }}
      >
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {msg && (
          <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative"}`}>{msg.text}</p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Enviar link
        </Button>
      </form>
    </div>
  );
}
