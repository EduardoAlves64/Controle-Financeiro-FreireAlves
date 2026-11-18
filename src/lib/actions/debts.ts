"use server";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { amortizationSchema, debtPaymentSchema, debtSchema, firstError, type DebtInput } from "@/lib/validation";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function createDebt(input: DebtInput): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = debtSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_debt", {
      p_name: v.name,
      p_creditor: v.creditor,
      p_type: v.type,
      p_original_amount: v.original_amount,
      p_interest_rate: v.interest_rate,
      p_installments: v.installments_count,
      p_installment_amount: v.installment_amount,
      p_contract_date: v.contract_date,
      p_first_due_date: v.first_due_date,
      p_owner: v.owner_id,
      p_scope: v.scope,
      p_visibility: v.visibility,
      p_priority: v.priority,
      p_notes: v.notes,
      p_paid_installments: v.paid_installments,
      p_is_demo: false,
      p_household: ctx.household.id,
    });
    if (error) return fail(error);
    return done({ id: data as string }, "Dívida cadastrada");
  });
}

export async function updateDebt(
  id: string,
  patch: { name?: string; creditor?: string | null; priority?: number; notes?: string | null },
): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("debts").update(patch).eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Dívida atualizada");
  });
}

export async function cancelDebt(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("debts").update({ status: "canceled" }).eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Dívida cancelada");
  });
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Dívida excluída");
  });
}

export async function payDebtInstallment(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = debtPaymentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase.rpc("pay_debt_installment", {
      p_installment: v.installment_id,
      p_account: v.account_id,
      p_amount: v.amount,
      p_date: v.date,
    });
    if (error) return fail(error);
    return done(undefined, "Pagamento registrado");
  });
}

export async function amortizeDebt(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = amortizationSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("amortize_debt", {
      p_debt: v.debt_id,
      p_account: v.account_id,
      p_amount: v.amount,
      p_date: v.date,
      p_strategy: v.strategy,
    });
    if (error) return fail(error);
    return done(undefined, `Amortização aplicada em ${data} parcela(s)`);
  });
}
