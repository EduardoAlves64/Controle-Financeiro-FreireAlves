import { addDays, addMonths, startOfMonth } from "date-fns";
import { parseISODate, toISODate } from "../dates";
import type { Frequency } from "../types";

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** Mesmo algoritmo de public.month_day: dia limitado ao fim do mês. */
export function monthDay(monthDate: Date, day: number): Date {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, last));
}

/** Espelho TS de public.recurrence_dates (usado para pré-visualizar próximos vencimentos). */
export function recurrenceDates(
  frequency: Frequency,
  start: string,
  dueDay: number,
  from: string,
  until: string,
): string[] {
  const out: string[] = [];
  if (frequency === "weekly" || frequency === "biweekly") {
    const step = frequency === "weekly" ? 7 : 14;
    let d = parseISODate(start);
    while (toISODate(d) <= until) {
      const iso = toISODate(d);
      if (iso >= from) out.push(iso);
      d = addDays(d, step);
    }
    return out;
  }
  const step = MONTH_STEP[frequency]!;
  const startDate = parseISODate(start);
  for (let k = 0; k < 2400; k++) {
    const iso = toISODate(monthDay(addMonths(startOfMonth(startDate), k * step), dueDay));
    if (iso > until) break;
    if (iso >= start && iso >= from) out.push(iso);
  }
  return out;
}
