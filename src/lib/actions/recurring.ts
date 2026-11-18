"use server";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { firstError, payInstanceSchema, recurringSchema, type RecurringInput } from "@/lib/validation";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function saveRecurring(input: RecurringInput): Promise<ActionResult> {
  return guard(async () => {
    const parsed = recurringSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { id, ...v } = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    if (id) {
      const { error } = await supabase.from("recurring_transactions").update(v).eq("id", id);
      if (error) return fail(error);
      // valor novo vale para as próximas ocorrências ainda não pagas
      await supabase
        .from("recurring_instances")
        .update({ amount: v.amount })
        .eq("recurring_id", id)
        .eq("status", "pending");
    } else {
      const { error } = await supabase.from("recurring_transactions").insert({ ...v, household_id: ctx.household.id });
      if (error) return fail(error);
    }
    await supabase.rpc("generate_recurring_instances", { p_household: ctx.household.id });
    return done(undefined, id ? "Conta fixa atualizada" : "Conta fixa criada");
  });
}

export async function setRecurringStatus(id: string, status: "active" | "paused"): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.from("recurring_transactions").update({ status }).eq("id", id);
    if (error) return fail(error);
    if (status === "active") await supabase.rpc("generate_recurring_instances", { p_household: ctx.household.id });
    return done(undefined, status === "paused" ? "Recorrência pausada" : "Recorrência retomada");
  });
}

export async function cancelRecurring(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_recurring", { p_recurring: id });
    if (error) return fail(error);
    return done(undefined, "Conta fixa cancelada");
  });
}

export async function payInstance(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = payInstanceSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase.rpc("pay_recurring_instance", {
      p_instance: v.instance_id,
      p_account: v.account_id,
      p_amount: v.amount,
      p_date: v.date,
    });
    if (error) return fail(error);
    return done(undefined, "Conta marcada como paga");
  });
}

export async function postponeInstance(id: string, newDate: string): Promise<ActionResult> {
  return guard(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return fail("Data inválida");
    const supabase = await createClient();
    const { error } = await supabase.from("recurring_instances").update({ due_date: newDate }).eq("id", id).eq("status", "pending");
    if (error) return fail(error);
    return done(undefined, "Vencimento adiado");
  });
}

export async function updateInstanceAmount(id: string, amount: number): Promise<ActionResult> {
  return guard(async () => {
    if (!(amount > 0)) return fail("Valor inválido");
    const supabase = await createClient();
    const { error } = await supabase
      .from("recurring_instances")
      .update({ amount: Math.round(amount * 100) / 100 })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return fail(error);
    return done(undefined, "Valor desta ocorrência alterado");
  });
}

export async function skipInstance(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("recurring_instances").update({ status: "skipped" }).eq("id", id).eq("status", "pending");
    if (error) return fail(error);
    return done(undefined, "Ocorrência ignorada");
  });
}
