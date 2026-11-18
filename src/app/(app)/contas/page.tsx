import { Landmark, PiggyBank, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { AccountsManager } from "@/components/accounts/accounts-manager";
import { getAppContext } from "@/lib/data/context";
import { byPerspective, getAccounts, getTransfers } from "@/lib/data/queries";
import { formatBRL, sumMoney } from "@/lib/money";

export const metadata = { title: "Contas e saldos" };

export default async function AccountsPage() {
  const ctx = await getAppContext();
  const [all, transfers] = await Promise.all([getAccounts(ctx, { includeArchived: true }), getTransfers(ctx)]);
  const visible = byPerspective(ctx, all);
  const active = visible.filter((a) => !a.archived_at);
  const archived = visible.filter((a) => a.archived_at);
  const available = sumMoney(active.filter((a) => a.include_in_total && a.type !== "investment").map((a) => a.balance ?? 0));
  const invested = sumMoney(active.filter((a) => a.type === "investment").map((a) => a.balance ?? 0));
  const ids = new Set(visible.map((a) => a.id));

  return (
    <div>
      <PageHeader title="Contas e saldos" description="Saldos calculados a partir das movimentações, transferências e ajustes." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Saldo disponível", v: available, icon: Wallet },
          { l: "Total investido", v: invested, icon: PiggyBank },
          { l: "Patrimônio em contas", v: available + invested, icon: Landmark },
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
      <AccountsManager
        accounts={active}
        archived={archived}
        transfers={transfers.filter((t) => ids.has(t.from_account_id) || ids.has(t.to_account_id))}
      />
    </div>
  );
}
