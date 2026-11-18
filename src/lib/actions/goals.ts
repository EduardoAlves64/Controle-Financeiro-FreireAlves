"use server";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { budgetSchema, contributionSchema, firstError, goalSchema, type GoalInput } from "@/lib/validation";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function saveGoal(input: GoalInput): Promise<ActionResult> {
  return guard(async () => {
    const parsed = goalSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { id, ...v } = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("financial_goals").update(v).eq("id", id)
      : await supabase.from("financial_goals").insert({ ...v, household_id: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, id ? "Meta atualizada" : "Meta criada");
  });
}

export async function setGoalStatus(id: string, status: "active" | "completed" | "archived"): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("financial_goals").update({ status }).eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Meta atualizada");
  });
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("financial_goals").delete().eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Meta excluída");
  });
}

export async function addContribution(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = contributionSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = await supabase.from("goal_contributions").insert({ ...parsed.data, household_id: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, parsed.data.amount > 0 ? "Aporte registrado" : "Resgate registrado");
  });
}

export async function deleteContribution(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("goal_contributions").delete().eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Movimento da meta removido");
  });
}

export async function saveBudget(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = budgetSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { id, ...v } = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("budgets").update(v).eq("id", id)
      : await supabase.from("budgets").upsert({ ...v, household_id: ctx.household.id }, { onConflict: "household_id,category_id" });
    if (error) return fail(error);
    return done(undefined, "Orçamento salvo");
  });
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Orçamento removido");
  });
}
