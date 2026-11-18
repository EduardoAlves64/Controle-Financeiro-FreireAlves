import { addMonths, addWeeks, addYears, endOfMonth, endOfQuarter, endOfYear, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { formatDate, isValidISODate, parseISODate, previousRange, toISODate, todayISO, weekRange, type DateRange } from "../dates";

export type PeriodKind = "semana" | "mes" | "trimestre" | "ano" | "custom";

export function resolvePeriod(kind: PeriodKind, anchor: string, from?: string, to?: string): { range: DateRange; previous: DateRange; label: string } {
  const d = parseISODate(anchor);
  let range: DateRange;
  let label: string;
  switch (kind) {
    case "semana":
      range = weekRange(anchor);
      label = `Semana de ${formatDate(range.from, "dd/MM")} a ${formatDate(range.to, "dd/MM/yyyy")}`;
      break;
    case "mes":
      range = { from: toISODate(startOfMonth(d)), to: toISODate(endOfMonth(d)) };
      label = formatDate(d, "MMMM 'de' yyyy");
      break;
    case "trimestre":
      range = { from: toISODate(startOfQuarter(d)), to: toISODate(endOfQuarter(d)) };
      label = `${Math.floor(d.getMonth() / 3) + 1}º trimestre de ${d.getFullYear()}`;
      break;
    case "ano":
      range = { from: toISODate(startOfYear(d)), to: toISODate(endOfYear(d)) };
      label = `Ano de ${d.getFullYear()}`;
      break;
    case "custom": {
      const f = isValidISODate(from) ? from : todayISO();
      const t = isValidISODate(to) && to >= f ? to : f;
      range = { from: f, to: t };
      label = `${formatDate(f)} a ${formatDate(t)}`;
      break;
    }
  }
  const previous =
    kind === "mes"
      ? { from: toISODate(startOfMonth(addMonths(d, -1))), to: toISODate(endOfMonth(addMonths(d, -1))) }
      : kind === "trimestre"
        ? { from: toISODate(startOfQuarter(addMonths(d, -3))), to: toISODate(endOfQuarter(addMonths(d, -3))) }
        : kind === "ano"
          ? { from: toISODate(startOfYear(addYears(d, -1))), to: toISODate(endOfYear(addYears(d, -1))) }
          : previousRange(range);
  return { range, previous, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

export function shiftAnchor(kind: PeriodKind, anchor: string, dir: 1 | -1): string {
  const d = parseISODate(anchor);
  if (kind === "semana") return toISODate(addWeeks(d, dir));
  if (kind === "mes") return toISODate(addMonths(d, dir));
  if (kind === "trimestre") return toISODate(addMonths(d, 3 * dir));
  return toISODate(addYears(d, dir));
}
