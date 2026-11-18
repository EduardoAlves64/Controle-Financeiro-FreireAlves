"use server";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { cardSchema, firstError, invoicePaymentSchema, type CardInput } from "@/lib/validation";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function saveCard(input: CardInput): Promise<ActionResult> {
  return guard(async () => {
    const parsed = cardSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const { id, ...v } = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("credit_cards").update(v).eq("id", id)
      : await supabase.from("credit_cards").insert({ ...v, household_id: ctx.household.id });
    if (error) return fail(error);
    return done(undefined, id ? "Cartão atualizado" : "Cartão cadastrado");
  });
}

export async function archiveCard(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("credit_cards").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Cartão arquivado");
  });
}

/** Pagamento de fatura: sai da conta, mas NÃO é uma nova despesa (as compras já foram contabilizadas). */
export async function payInvoice(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = invoicePaymentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase.rpc("pay_card_invoice", {
      p_invoice: v.invoice_id,
      p_account: v.account_id,
      p_amount: v.amount,
      p_date: v.date,
    });
    if (error) return fail(error);
    return done(undefined, "Pagamento da fatura registrado");
  });
}
