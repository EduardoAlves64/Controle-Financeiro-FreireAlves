"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { formatDate, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CalendarEventKind = "income" | "expense" | "bill" | "bill_income" | "debt" | "invoice" | "closing";
export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  amount: number | null;
  kind: CalendarEventKind;
  status: "paid" | "pending" | "overdue" | "info";
  href: string;
}

const KIND: Record<CalendarEventKind, { label: string; color: string }> = {
  income: { label: "Receita recebida", color: "#16A36A" },
  bill_income: { label: "Receita prevista", color: "#34D399" },
  expense: { label: "Despesa", color: "#4969E8" },
  bill: { label: "Conta a pagar", color: "#E08A2E" },
  debt: { label: "Parcela de dívida", color: "#9F1239" },
  invoice: { label: "Fatura de cartão", color: "#7C5CE0" },
  closing: { label: "Fechamento de cartão", color: "#A3A9B5" },
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function CalendarView({ events, date, view }: { events: CalendarEvent[]; date: string; view: "mes" | "semana" | "dia" }) {
  const router = useRouter();
  const today = todayISO();
  const [selected, setSelected] = useState<string>(date);
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    return m;
  }, [events]);

  const d = parseISODate(date);
  const go = (next: Date, v = view) => router.push(`/calendario?data=${toISODate(next)}&visao=${v}`, { scroll: false });
  const step = (dir: 1 | -1) => go(view === "mes" ? addMonths(d, dir) : view === "semana" ? addWeeks(d, dir) : addDays(d, dir));
  const title =
    view === "mes"
      ? formatDate(d, "MMMM 'de' yyyy")
      : view === "semana"
        ? `${formatDate(startOfWeek(d, { weekStartsOn: 1 }), "dd MMM")} – ${formatDate(endOfWeek(d, { weekStartsOn: 1 }), "dd MMM yyyy")}`
        : formatDate(d, "EEEE, dd 'de' MMMM");

  const dayList = (iso: string) => byDay.get(iso) ?? [];

  const EventItem = ({ e }: { e: CalendarEvent }) => (
    <Link href={e.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-2">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: KIND[e.kind].color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{e.title}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">{e.subtitle ?? KIND[e.kind].label}</p>
      </div>
      <div className="text-right">
        {e.amount !== null && (
          <p className={cn("text-[13.5px] font-semibold tabular", (e.kind === "income" || e.kind === "bill_income") && "text-positive")}>{formatBRL(e.amount)}</p>
        )}
        <p className={cn("text-[11px]", e.status === "overdue" ? "text-negative" : e.status === "paid" ? "text-positive" : "text-muted-foreground")}>
          {{ paid: "Pago", pending: "Pendente", overdue: "Vencido", info: "" }[e.status]}
        </p>
      </div>
    </Link>
  );

  const DayPanel = ({ iso }: { iso: string }) => {
    const items = dayList(iso);
    return (
      <Card className="p-4">
        <p className="mb-2 px-2 text-[13px] font-semibold capitalize">{formatDate(iso, "EEEE, dd 'de' MMMM")}</p>
        {items.length ? items.map((e) => <EventItem key={e.id} e={e} />) : <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação neste dia.</p>}
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Anterior"><ChevronLeft /></Button>
          <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Próximo"><ChevronRight /></Button>
          <h2 className="ml-1 text-lg font-semibold capitalize tracking-tight">{title}</h2>
          <Button variant="ghost" size="sm" onClick={() => { setSelected(today); go(parseISODate(today)); }}>Hoje</Button>
        </div>
        <Segmented
          value={view}
          onChange={(v) => go(d, v)}
          options={[{ value: "mes", label: "Mês" }, { value: "semana", label: "Semana" }, { value: "dia", label: "Dia" }]}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
        {Object.entries(KIND).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: v.color }} />{v.label}</span>
        ))}
      </div>

      {view === "mes" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 text-center text-[11.5px] font-medium text-muted-foreground">
              {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {eachDayOfInterval({ start: startOfWeek(startOfMonth(d), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(d), { weekStartsOn: 1 }) }).map((day) => {
                const iso = toISODate(day);
                const items = dayList(iso);
                const inMonth = day.getMonth() === d.getMonth();
                const out = items.filter((e) => ["expense", "bill", "debt", "invoice"].includes(e.kind)).reduce((a, e) => a + (e.amount ?? 0), 0);
                const hasOverdue = items.some((e) => e.status === "overdue");
                return (
                  <button
                    key={iso}
                    onClick={() => setSelected(iso)}
                    className={cn(
                      "flex min-h-[64px] flex-col items-stretch border-b border-r border-border/70 p-1.5 text-left transition md:min-h-[96px] md:p-2 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-surface-2/40 text-subtle-foreground",
                      selected === iso && "bg-primary-soft",
                      "hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-[12px] font-medium tabular",
                        iso === today && "bg-primary text-primary-foreground",
                        hasOverdue && iso !== today && "text-negative",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {items.length > 0 && (
                      <>
                        <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                          {items.slice(0, 4).map((e) => <span key={e.id} className="size-1.5 rounded-full" style={{ background: KIND[e.kind].color }} />)}
                        </div>
                        <div className="mt-1 hidden flex-col gap-0.5 md:flex">
                          {items.slice(0, 2).map((e) => (
                            <span key={e.id} className="truncate rounded px-1 py-px text-[10.5px] font-medium" style={{ background: `color-mix(in srgb, ${KIND[e.kind].color} 14%, transparent)`, color: KIND[e.kind].color }}>
                              {e.title}
                            </span>
                          ))}
                          {items.length > 2 && <span className="px-1 text-[10px] text-muted-foreground">+{items.length - 2}</span>}
                        </div>
                        {out > 0 && <span className="mt-auto hidden text-right text-[10.5px] text-muted-foreground tabular md:block">-{formatBRL(out)}</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="lg:sticky lg:top-20 lg:self-start"><DayPanel iso={selected} /></div>
        </div>
      )}

      {view === "semana" && (
        <div className="grid gap-3 md:grid-cols-7">
          {eachDayOfInterval({ start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) }).map((day) => {
            const iso = toISODate(day);
            const items = dayList(iso);
            return (
              <Card key={iso} className={cn("p-2", iso === today && "ring-2 ring-primary/40")}>
                <p className="px-1.5 pb-1 text-[12px] font-semibold capitalize">{formatDate(day, "EEE dd")}</p>
                {items.length ? items.map((e) => <EventItem key={e.id} e={e} />) : <p className="px-1.5 py-3 text-[12px] text-subtle-foreground">—</p>}
              </Card>
            );
          })}
        </div>
      )}

      {view === "dia" && <DayPanel iso={date} />}
    </div>
  );
}
