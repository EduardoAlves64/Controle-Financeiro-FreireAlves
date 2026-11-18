import { subMonths } from "date-fns";
import { AppDataProvider, type Suggestion } from "@/components/providers/app-data";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { QuickAdd } from "@/components/forms/quick-add";
import { ServiceWorker } from "@/components/shell/service-worker";
import { getAppContext } from "@/lib/data/context";
import { getTransactions, getUnreadCount, syncHousehold } from "@/lib/data/queries";
import { getAccounts, getCards } from "@/lib/data/cached";
import { toISODate } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  try {
    await syncHousehold(ctx); // gera ocorrências recorrentes e alertas (no máximo a cada 5 min)
  } catch (e) {
    console.error("[sync]", e);
  }
  const [accounts, cards, recent, unread] = await Promise.all([
    getAccounts(ctx),
    getCards(ctx),
    getTransactions(ctx, { from: toISODate(subMonths(new Date(), 4)), kinds: ["income", "expense"], limit: 400 }),
    getUnreadCount(),
  ]);

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const t of recent) {
    const description = t.description.replace(/ \(\d+\/\d+\)$/, "");
    const key = `${t.kind}:${description.toLowerCase()}`;
    if (seen.has(key) || t.debt_id || t.recurring_instance_id) continue;
    seen.add(key);
    suggestions.push({
      description,
      kind: t.kind as "income" | "expense",
      category_id: t.category_id,
      account_id: t.account_id,
      credit_card_id: t.credit_card_id,
      payment_method: t.payment_method,
      scope: t.scope,
    });
  }

  return (
    <AppDataProvider
      value={{
        userId: ctx.userId,
        householdId: ctx.household.id,
        householdName: ctx.household.name,
        members: ctx.members,
        me: ctx.me,
        partner: ctx.partner,
        categories: ctx.categories,
        accounts,
        cards,
        perspective: ctx.perspective,
        suggestions: suggestions.slice(0, 80),
        unread,
      }}
    >
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="print-full mx-auto w-full max-w-[1320px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">{children}</main>
        </div>
      </div>
      <BottomNav />
      <QuickAdd />
      <ServiceWorker />
    </AppDataProvider>
  );
}
