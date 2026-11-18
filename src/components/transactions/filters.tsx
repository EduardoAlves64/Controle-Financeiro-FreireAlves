"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Download, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useAppData } from "@/components/providers/app-data";
import { toCSV } from "@/lib/finance/reports";
import { formatDate } from "@/lib/dates";
import { formatDecimal } from "@/lib/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TransactionFilters({ transactions, month }: { transactions: Transaction[]; month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const app = useAppData();
  const [, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [open, setOpen] = useState(!!(sp.get("cat") || sp.get("pessoa") || sp.get("conta") || sp.get("escopo")));

  const set = (key: string, value: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    start(() => router.replace(`${pathname}?${p}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) set("q", q || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const exportCsv = () => {
    const rows = [
      ["Data", "Vencimento", "Descrição", "Tipo", "Status", "Categoria", "Valor (R$)", "Conta/Cartão", "Forma de pagamento", "Responsável", "Escopo", "Observações"],
      ...transactions.map((t) => [
        formatDate(t.date),
        t.due_date ? formatDate(t.due_date) : "",
        t.description,
        { income: "Receita", expense: "Despesa", invoice_payment: "Pagamento de fatura", adjustment: "Ajuste" }[t.kind],
        t.status === "paid" ? "Realizado" : "Previsto",
        app.categoryById(t.category_id)?.name ?? "",
        formatDecimal(t.kind === "income" || t.kind === "adjustment" ? t.amount : -Number(t.amount)),
        t.credit_card_id ? app.cards.find((c) => c.id === t.credit_card_id)?.name ?? "" : app.accounts.find((a) => a.id === t.account_id)?.name ?? "",
        t.payment_method ? PAYMENT_METHOD_LABEL[t.payment_method] : "",
        app.memberName(t.owner_id),
        t.scope === "shared" ? "Compartilhada" : "Individual",
        t.notes ?? "",
      ]),
    ];
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `movimentacoes-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tipo = sp.get("tipo") ?? "all";
  const activeFilters = ["cat", "pessoa", "conta", "escopo"].filter((k) => sp.get(k)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Segmented
          value={tipo}
          onChange={(v) => set("tipo", v === "all" ? null : v)}
          className="w-full md:w-auto"
          options={[
            { value: "all", label: "Todas" },
            { value: "expense", label: "Despesas" },
            { value: "income", label: "Receitas" },
            { value: "pending", label: "Previstas" },
          ]}
        />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descrição ou observação" className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen((o) => !o)} className={cn(activeFilters && "border-primary text-primary")}>
            <SlidersHorizontal /> Filtros{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!transactions.length}>
            <Download /> <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3 shadow-card md:grid-cols-5">
          <Select value={sp.get("cat") ?? ""} onChange={(e) => set("cat", e.target.value || null)}>
            <option value="">Todas as categorias</option>
            {app.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.kind === "income" ? "receita" : "despesa"})</option>
            ))}
          </Select>
          <Select value={sp.get("pessoa") ?? ""} onChange={(e) => set("pessoa", e.target.value || null)}>
            <option value="">Todas as pessoas</option>
            {app.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
            ))}
          </Select>
          <Select value={sp.get("conta") ?? ""} onChange={(e) => set("conta", e.target.value || null)}>
            <option value="">Contas e cartões</option>
            {app.accounts.map((a) => (
              <option key={a.id} value={`a:${a.id}`}>{a.name}</option>
            ))}
            {app.cards.map((c) => (
              <option key={c.id} value={`c:${c.id}`}>💳 {c.name}</option>
            ))}
          </Select>
          <Select value={sp.get("escopo") ?? ""} onChange={(e) => set("escopo", e.target.value || null)}>
            <option value="">Individual e casal</option>
            <option value="individual">Somente individuais</option>
            <option value="shared">Somente compartilhadas</option>
          </Select>
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              start(() => router.replace(`${pathname}${sp.get("mes") ? `?mes=${sp.get("mes")}` : ""}`));
            }}
          >
            <X /> Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
