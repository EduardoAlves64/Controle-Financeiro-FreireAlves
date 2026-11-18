import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCSV } from "@/lib/finance/reports";
import { formatDecimal } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";

/** Exportação completa (respeita o RLS: só sai o que o usuário pode ver). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [{ data: txs }, { data: cats }, { data: accounts }, { data: cards }, { data: profiles }] = await Promise.all([
    supabase.from("transactions").select("*").is("deleted_at", null).order("date", { ascending: false }).limit(50000),
    supabase.from("transaction_categories").select("id, name"),
    supabase.from("accounts").select("id, name"),
    supabase.from("credit_cards").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const name = (list: { id: string; name?: string; full_name?: string }[] | null, id: string | null) =>
    (id && list?.find((x) => x.id === id)) ? (list!.find((x) => x.id === id)!.name ?? list!.find((x) => x.id === id)!.full_name ?? "") : "";
  const KIND: Record<string, string> = { income: "Receita", expense: "Despesa", invoice_payment: "Pagamento de fatura", adjustment: "Ajuste" };

  const csv = toCSV([
    ["Data", "Vencimento", "Descrição", "Tipo", "Status", "Categoria", "Valor (R$)", "Conta", "Cartão", "Forma de pagamento", "Responsável", "Escopo", "Visibilidade", "Observações", "Demonstração"],
    ...(txs ?? []).map((t) => [
      formatDate(t.date),
      t.due_date ? formatDate(t.due_date) : "",
      t.description,
      KIND[t.kind],
      t.status === "paid" ? "Realizado" : "Previsto",
      name(cats, t.category_id),
      formatDecimal(t.kind === "income" || t.kind === "adjustment" ? t.amount : -Number(t.amount)),
      name(accounts, t.account_id),
      name(cards, t.credit_card_id),
      t.payment_method ? PAYMENT_METHOD_LABEL[t.payment_method as PaymentMethod] : "",
      name(profiles, t.owner_id),
      t.scope === "shared" ? "Compartilhada" : "Individual",
      t.visibility === "private" ? "Privada" : "Família",
      t.notes ?? "",
      t.is_demo ? "Sim" : "Não",
    ]),
  ]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-hub-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
