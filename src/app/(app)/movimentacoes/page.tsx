import { ArrowDownLeft, ArrowUpRight, ListOrdered, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { MonthPicker } from "@/components/shell/month-picker";
import { TransactionFilters } from "@/components/transactions/filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { NewTransactionButton } from "@/components/transactions/new-button";
import { getAppContext } from "@/lib/data/context";
import { byPerspective, getTransactions } from "@/lib/data/queries";
import { currentMonth, isValidMonth, monthRange } from "@/lib/dates";
import { formatBRL, sumMoney } from "@/lib/money";

export const metadata = { title: "Movimentações" };

type SP = { mes?: string; tipo?: string; cat?: string; pessoa?: string; conta?: string; q?: string; escopo?: string; status?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const month = isValidMonth(sp.mes) ? sp.mes : currentMonth();
  const range = monthRange(month);
  const ctx = await getAppContext();
  const all = byPerspective(ctx, await getTransactions(ctx, { from: range.from, to: range.to }));
  // inclui previstos com vencimento no mês mas data de lançamento anterior
  const q = sp.q?.trim().toLowerCase();
  const tipo = sp.status === "pending" ? "pending" : sp.tipo;

  const filtered = all.filter((t) => {
    if (tipo === "income" && t.kind !== "income") return false;
    if (tipo === "expense" && t.kind !== "expense") return false;
    if (tipo === "pending" && t.status !== "pending") return false;
    if (sp.cat && t.category_id !== sp.cat) return false;
    if (sp.pessoa && t.owner_id !== sp.pessoa) return false;
    if (sp.escopo && t.scope !== sp.escopo) return false;
    if (sp.conta?.startsWith("a:") && t.account_id !== sp.conta.slice(2)) return false;
    if (sp.conta?.startsWith("c:") && t.credit_card_id !== sp.conta.slice(2)) return false;
    if (q && !`${t.description} ${t.notes ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const income = sumMoney(filtered.filter((t) => t.kind === "income" && t.status === "paid").map((t) => t.amount));
  const expense = sumMoney(filtered.filter((t) => t.kind === "expense" && t.status === "paid").map((t) => t.amount));
  const pending = sumMoney(filtered.filter((t) => t.kind === "expense" && t.status === "pending").map((t) => t.amount));

  return (
    <div>
      <PageHeader
        title="Movimentações"
        description="Tudo o que entrou e saiu, dia a dia."
        actions={
          <>
            <MonthPicker month={month} />
            <NewTransactionButton />
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Receitas", v: income, icon: ArrowDownLeft, c: "text-positive" },
          { l: "Despesas", v: expense, icon: ArrowUpRight, c: "" },
          { l: "Resultado", v: income - expense, icon: Scale, c: income - expense < 0 ? "text-negative" : "text-primary" },
          { l: "Previstas", v: pending, icon: ListOrdered, c: "text-warning" },
        ].map((k) => (
          <Card key={k.l} className="px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><k.icon className="size-3.5" />{k.l}</p>
            <p className={`mt-1 text-lg font-semibold tabular ${k.c}`}>{formatBRL(k.v)}</p>
          </Card>
        ))}
      </div>
      <TransactionFilters transactions={filtered} month={month} />
      <Card className="mt-4 px-2 py-3 md:px-3">
        {filtered.length ? (
          <TransactionList transactions={filtered} />
        ) : (
          <EmptyState icon={ListOrdered} title="Nenhuma movimentação encontrada" description="Ajuste os filtros ou registre uma nova movimentação." />
        )}
      </Card>
      <p className="mt-3 text-center text-xs text-muted-foreground">{filtered.length} movimentaç{filtered.length === 1 ? "ão" : "ões"} · pagamentos de fatura e ajustes não entram nos totais de despesas</p>
    </div>
  );
}
