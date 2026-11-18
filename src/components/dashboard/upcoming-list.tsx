import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatDate, relativeDue } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Obligation } from "@/lib/finance/obligations";

export function UpcomingList({ items, nameOf }: { items: Obligation[]; nameOf: (id: string) => string }) {
  return (
    <ul className="flex flex-col">
      {items.map((o) => {
        const soon = o.status === "pending" && o.daysLeft <= 3;
        return (
          <li key={o.id}>
            <Link href={o.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-2 md:px-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none",
                  o.status === "overdue" && "bg-negative-soft text-negative",
                  o.status === "paid" && "bg-positive-soft text-positive",
                  o.status === "pending" && (soon ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted-foreground"),
                )}
              >
                <span className="text-[13px] font-semibold tabular">{formatDate(o.dueDate, "dd")}</span>
                <span className="text-[9.5px] uppercase">{formatDate(o.dueDate, "MMM").replace(".", "")}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{o.title}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {o.subtitle} · {nameOf(o.ownerId)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] font-semibold tabular">{formatBRL(o.amount)}</p>
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 text-[11.5px]",
                    o.status === "overdue" ? "text-negative" : o.status === "paid" ? "text-positive" : soon ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {o.status === "overdue" ? <AlertCircle className="size-3" /> : o.status === "paid" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                  {o.status === "paid" ? "Pago" : relativeDue(o.dueDate)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
