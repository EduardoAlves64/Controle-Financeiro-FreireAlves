import { CreditCard, Receipt, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { CardsGrid } from "@/components/cards/cards-grid";
import { getAppContext } from "@/lib/data/context";
import { byPerspective, getCards, getInvoices } from "@/lib/data/queries";
import { cardUsage, currentInvoice } from "@/lib/finance/cards";
import { todayISO } from "@/lib/dates";
import { formatBRL, sumMoney } from "@/lib/money";

export const metadata = { title: "Cartões de crédito" };

export default async function CardsPage() {
  const ctx = await getAppContext();
  const [cardsAll, invoices] = await Promise.all([getCards(ctx), getInvoices(ctx)]);
  const cards = byPerspective(ctx, cardsAll);
  const today = todayISO();
  const items = cards.map((card) => {
    const inv = invoices.filter((i) => i.card_id === card.id);
    const usage = cardUsage(inv, Number(card.credit_limit));
    const cur = currentInvoice(inv, today);
    return {
      card,
      ...usage,
      currentTotal: cur ? Number(cur.total) : 0,
      currentDue: cur?.due_date ?? null,
      currentStatus: cur?.status ?? null,
    };
  });
  const totalLimit = sumMoney(cards.map((c) => c.credit_limit));
  const totalUsed = sumMoney(items.map((i) => i.used));
  const openInvoices = sumMoney(items.map((i) => i.currentTotal));

  return (
    <div>
      <PageHeader title="Cartões de crédito" description="Compras contam como despesa na data da compra; o pagamento da fatura não é contado de novo." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Faturas atuais", v: openInvoices, icon: Receipt },
          { l: "Limite utilizado", v: totalUsed, icon: CreditCard },
          { l: "Limite disponível", v: totalLimit - totalUsed, icon: Wallet },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-4 p-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary"><k.icon className="size-5" /></span>
            <div>
              <p className="text-[12.5px] text-muted-foreground">{k.l}</p>
              <p className="text-xl font-semibold tracking-tight tabular">{formatBRL(k.v)}</p>
            </div>
          </Card>
        ))}
      </div>
      <CardsGrid items={items} />
    </div>
  );
}
