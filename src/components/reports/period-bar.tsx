"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { shiftAnchor, type PeriodKind } from "@/lib/finance/periods";
import { toCSV } from "@/lib/finance/reports";

export function PeriodBar({
  kind,
  anchor,
  label,
  from,
  to,
  csvRows,
  filename,
}: {
  kind: PeriodKind;
  anchor: string;
  label: string;
  from: string;
  to: string;
  csvRows: (string | number)[][];
  filename: string;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState({ from, to });
  const go = (k: PeriodKind, a = anchor) => router.push(`/relatorios?periodo=${k}&data=${a}`, { scroll: false });

  const exportCsv = () => {
    const blob = new Blob([toCSV(csvRows)], { type: "text/csv;charset=utf-8" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `${filename}.csv`;
    el.click();
    URL.revokeObjectURL(el.href);
  };

  return (
    <div className="no-print flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={kind}
          onChange={(k) => go(k)}
          className="w-full overflow-x-auto lg:w-auto"
          options={[
            { value: "semana", label: "Semanal" },
            { value: "mes", label: "Mensal" },
            { value: "trimestre", label: "Trimestral" },
            { value: "ano", label: "Anual" },
            { value: "custom", label: "Personalizado" },
          ]}
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer /> PDF</Button>
        </div>
      </div>
      {kind === "custom" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/relatorios?periodo=custom&de=${custom.from}&ate=${custom.to}`);
          }}
        >
          <Input type="date" className="w-auto" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <span className="text-sm text-muted-foreground">até</span>
          <Input type="date" className="w-auto" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          <Button type="submit">Aplicar</Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => go(kind, shiftAnchor(kind, anchor, -1))} aria-label="Período anterior"><ChevronLeft /></Button>
          <Button variant="outline" size="icon" onClick={() => go(kind, shiftAnchor(kind, anchor, 1))} aria-label="Próximo período"><ChevronRight /></Button>
          <span className="ml-1 text-[15px] font-semibold">{label}</span>
        </div>
      )}
    </div>
  );
}
