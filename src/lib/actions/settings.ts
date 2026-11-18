"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { categorySchema, firstError, householdSchema, profileSchema } from "@/lib/validation";
import { parsePerspective, PERSPECTIVE_COOKIE } from "@/lib/perspective";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function setPerspective(value: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  cookieStore.set(PERSPECTIVE_COOKIE, parsePerspective(value), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return done();
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update(parsed.data).eq("id", ctx.userId);
    if (error) return fail(error);
    return done(undefined, "Perfil atualizado");
  });
}

export async function updateAvatar(url: string | null): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    if (url && !url.includes(`/avatars/${ctx.userId}/`)) return fail("Imagem inválida");
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", ctx.userId);
    if (error) return fail(error);
    return done(undefined, "Foto atualizada");
  });
}

export async function updateNotificationPrefs(prefs: Record<string, boolean>): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    const clean = Object.fromEntries(Object.entries(prefs).filter(([k, v]) => /^[a-z_]{3,40}$/.test(k) && typeof v === "boolean"));
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ notification_prefs: clean }).eq("id", ctx.userId);
    if (error) return fail(error);
    return done(undefined, "Preferências salvas");
  });
}

export async function updateHousehold(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = householdSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.from("households").update(parsed.data).eq("id", ctx.household.id);
    if (error) return fail(error);
    return done(undefined, "Núcleo familiar atualizado");
  });
}

export async function regenerateInvite(): Promise<ActionResult<{ code: string }>> {
  return guard(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("regenerate_invite_code");
    if (error) return fail(error);
    return done({ code: data as string }, "Novo código gerado");
  });
}

export async function joinHousehold(code: string): Promise<ActionResult> {
  return guard(async () => {
    if (!/^[A-Za-z0-9]{6,12}$/.test(code.trim())) return fail("Código inválido");
    const supabase = await createClient();
    const { error } = await supabase.rpc("join_household", { p_code: code.trim() });
    if (error) return fail(error);
    return done(undefined, "Você entrou no núcleo familiar");
  });
}

export async function saveCategory(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { id, ...v } = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("transaction_categories").update({ name: v.name, icon: v.icon, color: v.color }).eq("id", id)
      : await supabase.from("transaction_categories").insert({ ...v, household_id: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, "Categoria salva");
  });
}

export async function archiveCategory(id: string, archived: boolean): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("transaction_categories")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return fail(error);
    return done(undefined, archived ? "Categoria arquivada" : "Categoria reativada");
  });
}

export async function loadDemoData(): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("seed_demo_data", { p_household: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, "Dados de demonstração carregados");
  });
}

export async function clearDemoData(): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("clear_demo_data", { p_household: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, "Dados de demonstração removidos. Bom começo!");
  });
}

export async function deleteMyAccount(confirmation: string): Promise<ActionResult> {
  return guard(async () => {
    if (confirmation !== "EXCLUIR") return fail('Digite "EXCLUIR" para confirmar');
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return fail(error);
    await supabase.auth.signOut();
    redirect("/login?conta=excluida");
  });
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (ids?.length) q = q.in("id", ids);
    const { error } = await q;
    if (error) return fail(error);
    return done();
  });
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return fail(error);
    return done();
  });
}

export async function refreshNotificationsNow(): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("sync_household", { p_household: ctx.household.id, p_force: true });
    if (error) return fail(error);
    return done(undefined, "Alertas atualizados");
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
