"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstError, resetSchema, signInSchema, signUpSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function authMessage(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/password/i.test(msg) && /weak|short/i.test(msg)) return "Senha muito fraca.";
  return "Não foi possível concluir. Tente novamente.";
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: authMessage(error.message) };
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(safeNext);
}

export async function signUp(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
      data: { full_name: v.full_name, ...(v.invite_code ? { invite_code: v.invite_code } : {}) },
    },
  });
  if (error) return { ok: false, error: authMessage(error.message) };
  if (data.session) redirect("/");
  return { ok: true, data: { needsConfirmation: true } };
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "E-mail inválido" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${await siteUrl()}/auth/callback?next=/recuperar-senha/nova`,
  });
  // resposta idêntica exista ou não o e-mail (evita enumeração de usuários)
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authMessage(error.message) };
  return { ok: true, message: "Senha alterada com sucesso" };
}
