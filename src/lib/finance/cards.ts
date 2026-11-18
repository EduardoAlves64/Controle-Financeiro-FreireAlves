import { subtractMoney, sumMoney } from "../money";
import type { Invoice } from "../types";

/** Limite usado = soma do que ainda não foi pago em faturas (inclui parcelas futuras). */
export function cardUsage(invoices: Invoice[], limit: number) {
  const used = sumMoney(invoices.filter((i) => i.status !== "paid").map((i) => Math.max(0, subtractMoney(i.total, i.paid_amount))));
  return { used, available: subtractMoney(limit, used) };
}

/** Fatura "atual": a primeira ainda aberta (fechamento >= hoje); senão a última não paga. */
export function currentInvoice(invoices: Invoice[], today: string): Invoice | null {
  const sorted = [...invoices].sort((a, b) => a.reference_month.localeCompare(b.reference_month));
  return (
    sorted.find((i) => i.closing_date > today) ??
    sorted.filter((i) => i.status !== "paid" && i.status !== "empty").at(-1) ??
    sorted.at(-1) ??
    null
  );
}
