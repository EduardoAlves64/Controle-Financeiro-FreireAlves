"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, nextMonth, previousMonth, currentMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function MonthPicker({ month, param = "mes", className }: { month: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const go = (m: string) => {
    const q = new URLSearchParams(sp.toString());
    if (m === currentMonth()) q.delete(param);
    else q.set(param, m);
    router.push(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  return (
    <div className={cn("inline-flex items-center rounded-xl border border-border bg-surface shadow-card", className)}>
      <button onClick={() => go(previousMonth(month))} className="flex size-9 items-center justify-center rounded-l-xl text-muted-foreground hover:bg-surface-2" aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={() => go(currentMonth())}
        className="min-w-36 px-2 text-center text-[13px] font-medium"
        title="Voltar para o mês atual"
      >
        {formatMonth(`${month}-01`)}
      </button>
      <button onClick={() => go(nextMonth(month))} className="flex size-9 items-center justify-center rounded-r-xl text-muted-foreground hover:bg-surface-2" aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
