import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CreditCard as CardIcon, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/ui/category-icon";
import { CardVisual } from "@/components/cards/card-visual";
import { CardDetailActions, PayInvoiceButton } from "@/components/cards/card-detail-actions";
import { DonutChart } from "@/components/charts/donut-chart";
import { getAppContext, memberName } from "@/lib/data/context";
import { getInvoices } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { cardUsage, currentInvoice } from "@/lib/finance/cards";
import { formatDate, formatMonth, todayISO } from "@/lib/dates";
import { formatBRL, fromCents, sumMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CreditCard, Transaction } from "@/lib/types";

export const metadata = { title: "Cartão" };

const STATUS: Record<string, { l: string; v: "primary" | "warning" | "negative" | "positive" | "neutral" }> = {
  open: { l: "Aberta", v: "primary" },
  closed: { l: "Fechada", v: "warning" },
  overdue: { l: "Vencida", v: "negative" },
  paid: { l: "Paga", v: "positive" },
  empty: { l: "Sem compras", v: "neutral" },
};

export default async function CardDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fatura?: string }> }) {
  const { id } = await params;
  const { fatura } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: card } = await supabase.from("credit_cards").select("*").eq("id", id).maybeSingle<CreditCard>();
  if (!card) notFound();

  const invoices = await getInvoices(ctx, id);
  const today = todayISO();
  const selected = (fatura && invoices.find((i) => i.reference_month.startsWith(fatura))) || currentInvoice(invoices, today);
  const usage = cardUsage(invoices, Number(card.credit_limit));

  const invoiceIds = invoices.map((i) => i.id);
  const { data: installments } = invoiceIds.length
    ? await supabase.from("credit_card_installments").select("id, invoice_id, purchase_id, number, amount").in("invoice_id", invoiceIds)
    : { data: [] as { id: string; invoice_id: string; purchase_id: string; number: number; amount: string }[] };
  const { data: purchases } = await supabase.from("credit_card_purchases").select("id, transaction_id, installments_count, purchase_date").eq("card_id", id);
  const txIds = (purchases ?? []).map((p) => p.transaction_id);
  const { data: txs } = txIds.length
    ? await supabase.from("transactions").select("id, description, category_id, owner_id, date, scope, deleted_at").in("id", txIds)
    : { data: [] as Pick<Transaction, "id" | "description" | "category_id" | "owner_id" | "date" | "scope">[] & { deleted_at: string | null }[] };

  const purchaseById = new Map((purchases ?? []).map((p) => [p.id, p]));
  const txById = new Map((txs ?? []).map((t) => [t.id, t as typeof t & { deleted_at: string | null }]));
  const lines = (installments ?? [])
    .map((ci) => {
      const p = purchaseById.get(ci.purchase_id);
      const t = p ? txById.get(p.transaction_id) : undefined;
      return t && !t.deleted_at ? { ...ci, amount: Number(ci.amount), total: p!.installments_count, tx: t } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const selectedLines = selected ? lines.filter((l) => l.invoice_id === selected.id).sort((a, b) => b.tx.date.localeCompare(a.tx.date)) : [];
  const futureTotal = sumMoney(
    lines.filter((l) => selected && invoices.find((i) => i.id === l.invoice_id)!.reference_month > selected.reference_month).map((l) => l.amount),
  );

  const catMap = new Map<string, number>();
  for (const l of selectedLines) catMap.set(l.tx.category_id ?? "none", (catMap.get(l.tx.category_id ?? "none") ?? 0) + toCents(l.amount));
  const catTotal = [...catMap.values()].reduce((a, b) => a + b, 0);
  const byCategory = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => {
      const cat = ctx.categories.find((x) => x.id === k);
      return { key: k, label: cat?.name ?? "Sem categoria", color: cat?.color ?? "#9AA1AE", total: fromCents(c), percent: catTotal ? (c / catTotal) * 100 : 0 };
    });

  const usedPct = Number(card.credit_limit) ? (usage.used / Number(card.credit_limit)) * 100 : 0;
  const visibleInvoices = invoices.filter((i) => Number(i.total) > 0 || i.id === selected?.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/cartoes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Cartões</Link>
          <h1 className="text-[26px] font-semibold tracking-tight">{card.name}</h1>
          <p className="text-sm text-muted-foreground">{card.bank ?? "Cartão"} · fecha dia {card.closing_day} · vence dia {card.due_day}</p>
        </div>
        <div className="flex flex-wrap gap-2"><CardDetailActions card={card} /></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="flex flex-col gap-4">
          <CardVisual name={card.name} bank={card.bank} brand={card.brand} last4={card.last4} color={card.color} holder={memberName(ctx, card.owner_id)} />
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-[12px] text-muted-foreground">Limite total</p><p className="font-semibold tabular">{formatBRL(card.credit_limit)}</p></div>
              <div><p className="text-[12px] text-muted-foreground">Disponível</p><p className="font-semibold text-positive tabular">{formatBRL(usage.available)}</p></div>
              <div><p className="text-[12px] text-muted-foreground">Utilizado</p><p className="font-semibold tabular">{formatBRL(usage.used)}</p></div>
              <div><p className="text-[12px] text-muted-foreground">Parcelas futuras</p><p className="font-semibold tabular">{formatBRL(futureTotal)}</p></div>
            </div>
            <Progress className="mt-4" value={usedPct} tone={usedPct > 90 ? "danger" : usedPct > 70 ? "warning" : "default"} />
            <p className="mt-2 text-[11.5px] text-muted-foreground">O limite usado considera todas as parcelas ainda não pagas.</p>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {visibleInvoices.map((i) => {
              const active = i.id === selected?.id;
              return (
                <Link
                  key={i.id}
                  href={`/cartoes/${card.id}?fatura=${i.reference_month.slice(0, 7)}`}
                  scroll={false}
                  className={cn(
                    "shrink-0 rounded-2xl border px-4 py-2.5 text-left transition",
                    active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  <p className={cn("text-[12px] font-medium capitalize", active ? "text-primary" : "text-muted-foreground")}>{formatDate(i.reference_month, "MMM yyyy")}</p>
                  <p className="text-[14px] font-semibold tabular">{formatBRL(i.total)}</p>
                </Link>
              );
            })}
          </div>

          {selected ? (
            <Card>
              <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-semibold">Fatura de {formatMonth(selected.reference_month).toLowerCase()}</h2>
                    <Badge variant={STATUS[selected.status].v}>{STATUS[selected.status].l}</Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-[12.5px] text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarClock className="size-3.5" /> Fecha {formatDate(selected.closing_date)}</span>
                    <span className="flex items-center gap-1"><Wallet className="size-3.5" /> Vence {formatDate(selected.due_date)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight tabular">{formatBRL(selected.total)}</p>
                    {Number(selected.paid_amount) > 0 && <p className="text-[12px] text-positive tabular">Pago: {formatBRL(selected.paid_amount)}</p>}
                  </div>
                  <PayInvoiceButton invoice={selected} cardName={card.name} />
                </div>
              </div>
              <div className="p-2 md:p-3">
                {selectedLines.length ? (
                  selectedLines.map((l) => {
                    const cat = ctx.categories.find((c) => c.id === l.tx.category_id);
                    return (
                      <div key={l.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                        <CategoryIcon icon={cat?.icon} color={cat?.color} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{l.tx.description}</p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {formatDate(l.tx.date, "dd/MM")} · {cat?.name ?? "Sem categoria"} · {memberName(ctx, l.tx.owner_id)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-semibold tabular">{formatBRL(l.amount)}</p>
                          {l.total > 1 && <p className="text-[11.5px] text-muted-foreground">Parcela {l.number}/{l.total}</p>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma compra nesta fatura.</p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="py-12 text-center text-sm text-muted-foreground">
              <CardIcon className="mx-auto mb-3 size-6" />
              Nenhuma fatura ainda. Registre a primeira compra.
            </Card>
          )}

          {byCategory.length > 0 && (
            <Card>
              <CardHeader title="Gastos da fatura por categoria" />
              <CardContent><DonutChart data={byCategory} centerLabel="Fatura" /></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="Histórico de faturas" />
            <CardContent className="pt-3">
              <ul className="divide-y divide-border">
                {[...visibleInvoices].reverse().map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2.5 text-[13.5px]">
                    <Link href={`/cartoes/${card.id}?fatura=${i.reference_month.slice(0, 7)}`} className="capitalize hover:text-primary">{formatMonth(i.reference_month)}</Link>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular">{formatBRL(i.total)}</span>
                      <Badge variant={STATUS[i.status].v}>{STATUS[i.status].l}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
