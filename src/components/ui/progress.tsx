import { cn } from "@/lib/utils";

export function Progress({
  value,
  color,
  className,
  tone,
}: {
  value: number;
  color?: string;
  className?: string;
  tone?: "default" | "warning" | "danger" | "positive";
}) {
  const v = Math.max(0, Math.min(100, value));
  const toneClass =
    tone === "danger" ? "bg-negative" : tone === "warning" ? "bg-warning" : tone === "positive" ? "bg-positive" : "bg-primary";
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", !color && toneClass)}
        style={{ width: `${v}%`, background: color }}
      />
    </div>
  );
}
