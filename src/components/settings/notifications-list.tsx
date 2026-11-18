"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertCircle, Bell, CalendarClock, CheckCheck, CreditCard, HandCoins, PiggyBank, RefreshCw, Trash2, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteNotification, markNotificationsRead, refreshNotificationsNow } from "@/lib/actions/settings";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

const ICON: Record<string, { i: typeof Bell; c: string }> = {
  bill_due_soon: { i: CalendarClock, c: "bg-warning-soft text-warning" },
  bill_overdue: { i: AlertCircle, c: "bg-negative-soft text-negative" },
  card_closing: { i: CreditCard, c: "bg-primary-soft text-primary" },
  invoice_due: { i: CreditCard, c: "bg-warning-soft text-warning" },
  budget_warning: { i: Wallet, c: "bg-warning-soft text-warning" },
  budget_exceeded: { i: Wallet, c: "bg-negative-soft text-negative" },
  goal_reached: { i: Trophy, c: "bg-positive-soft text-positive" },
  debt_installment_due: { i: HandCoins, c: "bg-warning-soft text-warning" },
};

export function NotificationsList({ items }: { items: AppNotification[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((n) => !n.read_at).length;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, toastOk = false) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (toastOk) toast.success(r.message);
      router.refresh();
    });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo lido"}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={pending} onClick={() => run(refreshNotificationsNow, true)}><RefreshCw /> Verificar agora</Button>
          <Button variant="outline" size="sm" disabled={!unread} onClick={() => run(() => markNotificationsRead())}><CheckCheck /> Marcar todas como lidas</Button>
        </div>
      </div>
      <Card className="p-2">
        {items.length === 0 ? (
          <EmptyState icon={PiggyBank} title="Nenhuma notificação" description="Alertas de vencimentos, faturas, orçamentos e metas aparecerão aqui." />
        ) : (
          items.map((n) => {
            const meta = ICON[n.type] ?? { i: Bell, c: "bg-surface-2 text-muted-foreground" };
            return (
              <div key={n.id} className={cn("group flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-surface-2", !n.read_at && "bg-primary-soft/40")}>
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", meta.c)}><meta.i className="size-4" /></span>
                <Link
                  href={n.link ?? "#"}
                  onClick={() => !n.read_at && void markNotificationsRead([n.id])}
                  className="min-w-0 flex-1"
                >
                  <p className="flex items-center gap-2 text-[14px] font-medium">
                    {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-[13px] text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11.5px] text-subtle-foreground">{formatDate(n.created_at.slice(0, 10), "dd 'de' MMM")}</p>
                </Link>
                <Button variant="ghost" size="icon-sm" aria-label="Remover" className="opacity-60 group-hover:opacity-100" onClick={() => run(() => deleteNotification(n.id))}><Trash2 /></Button>
              </div>
            );
          })
        )}
      </Card>
    </>
  );
}
