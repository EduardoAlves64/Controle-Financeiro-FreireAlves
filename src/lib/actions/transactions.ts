"use server";
import { addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/data/context";
import { firstError, transactionSchema, type TransactionInput } from "@/lib/validation";
import { parseISODate, toISODate, todayISO } from "@/lib/dates";
import { splitInstallments } from "@/lib/money";
import { done, fail, guard } from "./helpers";
import type { ActionResult } from "@/lib/types";

export async function saveTransaction(input: TransactionInput): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const ctx = await getAppContext();
    const supabase = await createClient();
    const hid = ctx.household.id;
    const isCard = v.kind === "expense" && v.payment_method === "credit_card";

    // ---------- edição ----------
    if (v.id) {
      const { data: current } = await supabase.from("transactions").select("credit_card_id, kind").eq("id", v.id).single();
      if (!current) return fail("Movimentação não encontrada");
      const patch = current.credit_card_id
        ? { description: v.description, category_id: v.category_id, notes: v.notes, owner_id: v.owner_id, scope: v.scope }
        : {
            description: v.description,
            amount: v.amount,
            category_id: v.category_id,
            date: v.date,
            due_date: v.due_date,
            status: v.status,
            account_id: v.account_id,
            payment_method: v.payment_method ?? null,
            owner_id: v.owner_id,
            scope: v.scope,
            visibility: v.visibility,
            notes: v.notes,
          };
      const { error } = await supabase.from("transactions").update(patch).eq("id", v.id);
      if (error) return fail(error);
      return done({ id: v.id }, "Movimentação atualizada");
    }

    // ---------- compra no cartão (1 despesa + parcelas nas faturas) ----------
    if (isCard) {
      const { data, error } = await supabase.rpc("register_card_purchase", {
        p_card: v.credit_card_id,
        p_description: v.description,
        p_amount: v.amount,
        p_installments: v.installments,
        p_date: v.date,
        p_category: v.category_id,
        p_owner: v.owner_id,
        p_scope: v.scope,
        p_visibility: v.visibility,
        p_notes: v.notes,
      });
      if (error) return fail(error);
      return done({ id: data as string }, v.installments > 1 ? `Compra lançada em ${v.installments}x no cartão` : "Compra lançada no cartão");
    }

    const base = {
      household_id: hid,
      kind: v.kind,
      description: v.description,
      category_id: v.category_id,
      account_id: v.account_id,
      payment_method: v.payment_method ?? null,
      owner_id: v.owner_id,
      scope: v.scope,
      visibility: v.visibility,
      notes: v.notes,
    };

    // ---------- recorrente: cria a conta fixa e já registra a primeira ocorrência ----------
    if (v.repeat !== "none") {
      const { data: rec, error } = await supabase
        .from("recurring_transactions")
        .insert({
          household_id: hid,
          name: v.description,
          kind: v.kind,
          amount: v.amount,
          category_id: v.category_id,
          account_id: v.account_id,
          payment_method: v.payment_method && v.payment_method !== "credit_card" ? v.payment_method : "pix",
          frequency: v.repeat,
          due_day: parseISODate(v.date).getDate(),
          start_date: v.date,
          owner_id: v.owner_id,
          scope: v.scope,
          visibility: v.visibility,
          notes: v.notes,
        })
        .select("id")
        .single();
      if (error) return fail(error);
      await supabase.rpc("generate_recurring_instances", { p_household: hid });
      if (v.status === "paid") {
        const { data: inst } = await supabase
          .from("recurring_instances")
          .select("id")
          .eq("recurring_id", rec.id)
          .eq("original_due_date", v.date)
          .maybeSingle();
        if (inst) {
          const { error: payErr } = await supabase.rpc("pay_recurring_instance", {
            p_instance: inst.id,
            p_account: v.account_id,
            p_amount: v.amount,
            p_date: v.date,
          });
          if (payErr) return fail(payErr);
        }
      }
      return done({ id: rec.id }, "Lançamento recorrente criado");
    }

    // ---------- parcelado fora do cartão (boleto, carnê...) ----------
    if (v.installments > 1) {
      const group = crypto.randomUUID();
      const amounts = splitInstallments(v.amount, v.installments);
      const start = parseISODate(v.due_date ?? v.date);
      const rows = amounts.map((amount, i) => {
        const due = toISODate(addMonths(start, i));
        const paid = i === 0 && v.status === "paid";
        return {
          ...base,
          amount,
          description: `${v.description} (${i + 1}/${v.installments})`,
          date: i === 0 ? v.date : due,
          due_date: due,
          status: paid ? "paid" : "pending",
          installment_group: group,
          installment_number: i + 1,
          installment_total: v.installments,
        };
      });
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) return fail(error);
      return done({ id: group }, `Lançadas ${v.installments} parcelas`);
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({ ...base, amount: v.amount, date: v.date, due_date: v.due_date, status: v.status })
      .select("id")
      .single();
    if (error) return fail(error);
    return done({ id: data.id }, v.kind === "income" ? "Receita registrada" : "Despesa registrada");
  });
}

/** Estorno/exclusão lógica: preserva histórico e reverte efeitos (conta fixa volta a pendente, dívida reabre). */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reverse_transaction", { p_transaction: id });
    if (error) return fail(error);
    return done(undefined, "Movimentação excluída");
  });
}

export async function markTransactionPaid(id: string, accountId: string | null, date?: string): Promise<ActionResult> {
  return guard(async () => {
    const supabase = await createClient();
    const patch: Record<string, unknown> = { status: "paid", paid_at: date ?? todayISO() };
    if (accountId) patch.account_id = accountId;
    const { error } = await supabase.from("transactions").update(patch).eq("id", id);
    if (error) return fail(error);
    return done(undefined, "Marcada como paga");
  });
}

export async function addAttachment(input: {
  transaction_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<ActionResult> {
  return guard(async () => {
    const ctx = await getAppContext();
    if (!input.storage_path.startsWith(`${ctx.household.id}/`)) return fail("Caminho de arquivo inválido");
    const supabase = await createClient();
    const { error } = await supabase.from("attachments").insert({ household_id: ctx.household.id, ...input });
    if (error) return fail(error);
    return done();
  });
}

export async function getAttachmentUrl(path: string): Promise<ActionResult<{ url: string }>> {
  return guard<{ url: string }>(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error) return fail(error.message);
    return { ok: true, data: { url: data.signedUrl } };
  });
}
