import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBRL, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

export function ChangeBadge({ value, inverse, suffix = "vs mês anterior" }: { value: number | null; inverse?: boolean; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-[11.5px] text-subtle-foreground">sem base de comparação</span>;
  const up = value > 0.5;
  const down = value < -0.5;
  const good = inverse ? down : up;
  const bad = inverse ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular",
          good && "bg-positive-soft text-positive",
          bad && "bg-negative-soft text-negative",
          !good && !bad && "bg-surface-2 text-muted-foreground",
        )}
      >
        <Icon className="size-3" />
        {formatPercent(Math.abs(value))}
      </span>
      {suffix}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  change,
  inverse,
  hint,
  children,
  className,
  valueClassName,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "primary" | "positive" | "negative" | "warning" | "neutral";
  change?: number | null;
  inverse?: boolean;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
    warning: "bg-warning-soft text-warning",
    neutral: "bg-surface-2 text-muted-foreground",
  }[tone];
  return (
    <Card className={cn("flex flex-col gap-3 p-4 md:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className={cn("whitespace-nowrap text-[19px] font-semibold leading-none tracking-tight tabular sm:text-[22px] md:text-2xl", valueClassName)}>
        {typeof value === "number" ? formatBRL(value) : value}
      </p>
      <div className="min-h-4">
        {change !== undefined ? <ChangeBadge value={change} inverse={inverse} /> : null}
        {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}
