"use server";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { accountSchema, adjustmentSchema, firstError, transferSchema, type AccountInput } from "@/lib/validation";
import { subtractMoney } from "@/lib/money";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function saveAccount(input: AccountInput): Promise<ActionResult> {
  return guard(async () => {
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { id, ...v } = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("accounts").update(v).eq("id", id)
      : await supabase.from("accounts").insert({ ...v, household_id: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, id ? "Conta atualizada" : "Conta criada");
  });
}

export async function archiveAccount(id: string, archived: boolean): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("accounts")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return fail(error);
    return done(undefined, archived ? "Conta arquivada" : "Conta reativada");
  });
}

export async function createTransfer(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.from("transfers").insert({ ...parsed.data, household_id: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, "Transferência registrada");
  });
}

export async function deleteTransfer(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("transfers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Transferência excluída");
  });
}

/** Conciliação: lança um ajuste identificado para que o saldo calculado bata com o saldo real do banco. */
export async function reconcileAccount(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = adjustmentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { data: balances, error: bErr } = await supabase.rpc("account_balances", { p_household: ctx.household.id });
    if (bErr) return fail(bErr);
    const current = (balances as { account_id: string; balance: number }[]).find((b) => b.account_id === v.account_id);
    if (!current) return fail("Conta não encontrada");
    const diff = subtractMoney(v.target_balance, current.balance);
    if (diff === 0) return done(undefined, "O saldo já está conciliado");
    const { data: account } = await supabase.from("accounts").select("owner_id, scope, visibility").eq("id", v.account_id).single();
    const { error } = await supabase.from("transactions").insert({
      household_id: ctx.household.id,
      kind: "adjustment",
      status: "paid",
      description: v.description ?? "Ajuste de conciliação de saldo",
      amount: diff,
      date: v.date,
      account_id: v.account_id,
      owner_id: account?.owner_id ?? ctx.userId,
      scope: account?.scope ?? "individual",
      visibility: account?.visibility ?? "household",
      notes: `Saldo anterior calculado: ${current.balance}. Saldo informado: ${v.target_balance}.`,
    });
    if (error) return fail(error);
    return done(undefined, "Saldo conciliado com um ajuste identificado");
  });
}
