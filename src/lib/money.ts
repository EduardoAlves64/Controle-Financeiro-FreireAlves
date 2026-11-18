/**
 * Dinheiro é sempre manipulado em CENTAVOS inteiros para cálculos.
 * O banco guarda numeric(14,2); a API devolve number ou string.
 */
export type MoneyLike = number | string | null | undefined;

export function toCents(value: MoneyLike): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function sumMoney(values: MoneyLike[]): number {
  return fromCents(values.reduce<number>((acc, v) => acc + toCents(v), 0));
}

export function subtractMoney(a: MoneyLike, b: MoneyLike): number {
  return fromCents(toCents(a) - toCents(b));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** R$ 1.234,56 (com espaço comum, não o NBSP do Intl, para facilitar exportações) */
export function formatBRL(value: MoneyLike, opts: { signed?: boolean } = {}): string {
  const n = fromCents(toCents(value));
  const out = brl.format(Math.abs(n)).replace(/ /g, " ");
  if (n < 0) return `-${out}`;
  if (opts.signed && n > 0) return `+${out}`;
  return out;
}

export function formatCompactBRL(value: MoneyLike): string {
  return brlCompact.format(fromCents(toCents(value))).replace(/ /g, " ");
}

export function formatDecimal(value: MoneyLike): string {
  return decimal.format(fromCents(toCents(value)));
}

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" */
export function parseBRL(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  const hasComma = clean.includes(",");
  const normalized = hasComma ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? fromCents(Math.round(n * 100)) : 0;
}

/** Divide um total em N parcelas; a diferença de centavos vai para a primeira (igual ao banco). */
export function splitInstallments(total: MoneyLike, count: number): number[] {
  const cents = toCents(total);
  if (count < 1) throw new Error("Quantidade de parcelas inválida");
  const base = Math.floor(cents / count);
  const rem = cents - base * count;
  return Array.from({ length: count }, (_, i) => fromCents(base + (i === 0 ? rem : 0)));
}

/** Variação percentual; null quando não há base de comparação. */
export function percentChange(current: MoneyLike, previous: MoneyLike): number | null {
  const p = toCents(previous);
  const c = toCents(current);
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}

export function percentOf(part: MoneyLike, whole: MoneyLike): number {
  const w = toCents(whole);
  if (w === 0) return 0;
  return (toCents(part) / w) * 100;
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}
