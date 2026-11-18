import { differenceInCalendarMonths } from "date-fns";
import { parseISODate, todayISO } from "../dates";
import { fromCents, toCents, type MoneyLike } from "../money";

/** Parcela fixa (Tabela Price). rate em % ao mês. */
export function pmt(principal: number, ratePct: number, periods: number): number {
  if (periods <= 0) return 0;
  const i = ratePct / 100;
  if (i === 0) return fromCents(Math.ceil(toCents(principal) / periods));
  const value = (principal * i) / (1 - Math.pow(1 + i, -periods));
  return fromCents(Math.round(value * 100));
}

export interface PendingInstallment {
  due_date: string;
  remaining: MoneyLike;
}

/**
 * Simulação de quitação antecipada: valor presente das parcelas restantes
 * descontadas pela taxa do contrato (direito garantido pelo CDC para quitação antecipada).
 */
export function payoffSimulation(installments: PendingInstallment[], ratePct: number, onDate: string = todayISO()) {
  const i = ratePct / 100;
  const base = parseISODate(onDate);
  let nominal = 0;
  let present = 0;
  for (const inst of installments) {
    const cents = toCents(inst.remaining);
    if (cents <= 0) continue;
    nominal += cents;
    const months = Math.max(0, differenceInCalendarMonths(parseISODate(inst.due_date), base));
    present += i === 0 ? cents : cents / Math.pow(1 + i, months);
  }
  const presentCents = Math.round(present);
  return {
    nominal: fromCents(nominal),
    payoffToday: fromCents(presentCents),
    savings: fromCents(nominal - presentCents),
  };
}

export function debtProgress(paid: MoneyLike, total: MoneyLike): number {
  const t = toCents(total);
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, (toCents(paid) / t) * 100));
}

/** Prioridade sugerida: juros maiores e atrasos primeiro (método avalanche). */
export function debtPriorityScore(d: { interest_rate: MoneyLike; priority: number; overdue: boolean }): number {
  return Number(d.interest_rate || 0) * 10 + (4 - d.priority) * 5 + (d.overdue ? 50 : 0);
}
