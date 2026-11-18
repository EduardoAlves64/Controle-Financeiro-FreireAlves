import { differenceInCalendarMonths, addMonths } from "date-fns";
import { parseISODate, toISODate, todayISO } from "../dates";
import { fromCents, toCents, type MoneyLike } from "../money";

export interface GoalProjection {
  saved: number;
  remaining: number;
  percent: number;
  monthlyNeeded: number | null;
  monthsLeft: number | null;
  avgMonthly: number;
  forecastDate: string | null;
}

/** Projeções de metas usando somente os aportes registrados. */
export function projectGoal(
  target: MoneyLike,
  targetDate: string | null,
  contributions: { amount: MoneyLike; date: string }[],
  today: string = todayISO(),
): GoalProjection {
  const savedC = contributions.reduce((a, c) => a + toCents(c.amount), 0);
  const targetC = toCents(target);
  const remainingC = Math.max(0, targetC - savedC);
  const base = parseISODate(today);

  let monthsLeft: number | null = null;
  let monthlyNeeded: number | null = null;
  if (targetDate) {
    monthsLeft = Math.max(0, differenceInCalendarMonths(parseISODate(targetDate), base));
    monthlyNeeded = remainingC === 0 ? 0 : fromCents(Math.ceil(remainingC / Math.max(1, monthsLeft)));
  }

  // média mensal dos aportes dos últimos 3 meses
  const from = toISODate(addMonths(base, -3));
  const recent = contributions.filter((c) => c.date > from && c.date <= today).reduce((a, c) => a + toCents(c.amount), 0);
  const avgC = Math.max(0, Math.round(recent / 3));
  const forecastDate =
    remainingC === 0 ? today : avgC > 0 ? toISODate(addMonths(base, Math.ceil(remainingC / avgC))) : null;

  return {
    saved: fromCents(savedC),
    remaining: fromCents(remainingC),
    percent: targetC ? Math.min(100, (savedC / targetC) * 100) : 0,
    monthlyNeeded,
    monthsLeft,
    avgMonthly: fromCents(avgC),
    forecastDate,
  };
}
