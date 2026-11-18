import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const TIMEZONE = "America/Sao_Paulo";

/** "YYYY-MM-DD" -> Date local (sem deslocamento de fuso) */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Data de hoje no fuso de Brasília (o servidor na Vercel roda em UTC). */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA => YYYY-MM-DD
}

export function today(): Date {
  return parseISODate(todayISO());
}

export function formatDate(value: string | Date, pattern = "dd/MM/yyyy"): string {
  const d = typeof value === "string" ? parseISODate(value) : value;
  return format(d, pattern, { locale: ptBR });
}

export function formatMonth(value: string | Date): string {
  const s = formatDate(value, "MMMM 'de' yyyy");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortMonth(value: string | Date): string {
  return formatDate(value, "MMM").replace(".", "");
}

export function daysUntil(value: string, from: string = todayISO()): number {
  return differenceInCalendarDays(parseISODate(value), parseISODate(from));
}

export function relativeDue(value: string, from: string = todayISO()): string {
  const d = daysUntil(value, from);
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  if (d > 1) return `Vence em ${d} dias`;
  if (d === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(d)} dias`;
}

export type DateRange = { from: string; to: string };

export function monthRange(month: string): DateRange {
  const d = parseISODate(`${month.slice(0, 7)}-01`);
  return { from: toISODate(startOfMonth(d)), to: toISODate(endOfMonth(d)) };
}

export function previousMonth(month: string): string {
  return toISODate(subMonths(parseISODate(`${month.slice(0, 7)}-01`), 1)).slice(0, 7);
}

export function nextMonth(month: string): string {
  return toISODate(addMonths(parseISODate(`${month.slice(0, 7)}-01`), 1)).slice(0, 7);
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

/** Semana de segunda a domingo */
export function weekRange(anyDay: string): DateRange {
  const d = parseISODate(anyDay);
  return {
    from: toISODate(startOfWeek(d, { weekStartsOn: 1 })),
    to: toISODate(endOfWeek(d, { weekStartsOn: 1 })),
  };
}

export function shiftRange(range: DateRange, days: number): DateRange {
  return {
    from: toISODate(addDays(parseISODate(range.from), days)),
    to: toISODate(addDays(parseISODate(range.to), days)),
  };
}

/** Período anterior de mesma duração */
export function previousRange(range: DateRange): DateRange {
  const len = differenceInCalendarDays(parseISODate(range.to), parseISODate(range.from)) + 1;
  return shiftRange(range, -len);
}

export function inRange(date: string, range: DateRange): boolean {
  const d = date.slice(0, 10);
  return d >= range.from && d <= range.to;
}

export function lastMonths(month: string, count: number): string[] {
  const base = parseISODate(`${month.slice(0, 7)}-01`);
  return Array.from({ length: count }, (_, i) => toISODate(subMonths(base, count - 1 - i)).slice(0, 7));
}

export function isValidMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isValidISODate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISODate(value).getTime());
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(now),
  );
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
