import { formatBRL } from "@/lib/money";

export function PersonBars({ data, empty = "Sem despesas no período" }: { data: { key: string; label: string; total: number; percent: number; color: string }[]; empty?: string }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-4">
      {data.map((p) => (
        <li key={p.key}>
          <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
            <span className="font-medium">{p.label}</span>
            <span className="tabular">
              <span className="font-semibold">{formatBRL(p.total)}</span>
              <span className="ml-2 text-xs text-muted-foreground">{p.percent.toFixed(0)}%</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p.percent}%`, background: p.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
