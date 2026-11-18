"use client";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eye, EyeOff, TrendingDown, TrendingUp } from "lucide-react";
import { useAppData } from "@/components/providers/app-data";
import { formatBRL, formatPercent } from "@/lib/money";
import { perspectiveLabel } from "@/lib/perspective";
import { firstName } from "@/lib/utils";

export function HeroBalance({
  balance,
  change,
  income,
  expense,
  accountsCount,
}: {
  balance: number;
  change: number | null;
  income: number;
  expense: number;
  accountsCount: number;
}) {
  const { openQuickAdd, perspective, partner } = useAppData();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("fh_hide_values") === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setHidden((h) => {
      try {
        localStorage.setItem("fh_hide_values", h ? "0" : "1");
      } catch {}
      return !h;
    });
  };
  const mask = (v: string) => (hidden ? "R$ ••••••" : v);

  return (
    <div className="hero-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-elevated md:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-medium text-white/85 backdrop-blur">
          {perspectiveLabel(perspective, partner ? firstName(partner.full_name) : undefined)} · {accountsCount} {accountsCount === 1 ? "conta" : "contas"}
        </span>
        <button onClick={toggle} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}>
          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p className="relative mt-5 text-[13px] text-white/70">Saldo disponível</p>
      <p className="relative mt-1 text-[34px] font-semibold leading-none tracking-tight tabular md:text-[40px]">{mask(formatBRL(balance))}</p>
      <div className="relative mt-3 flex items-center gap-2 text-[12px] text-white/75">
        {change !== null && Number.isFinite(change) ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${change >= 0 ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>
            {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {formatPercent(Math.abs(change), 1)}
          </span>
        ) : null}
        <span>{change !== null ? "em relação ao fim do mês anterior" : "Cadastre contas para acompanhar"}</span>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white/10 px-3.5 py-3 backdrop-blur">
          <p className="flex items-center gap-1.5 text-[11.5px] text-white/70"><ArrowDownLeft className="size-3.5" /> Entrou no mês</p>
          <p className="mt-1 text-[15px] font-semibold tabular">{mask(formatBRL(income))}</p>
        </div>
        <div className="rounded-2xl bg-white/10 px-3.5 py-3 backdrop-blur">
          <p className="flex items-center gap-1.5 text-[11.5px] text-white/70"><ArrowUpRight className="size-3.5" /> Saiu no mês</p>
          <p className="mt-1 text-[15px] font-semibold tabular">{mask(formatBRL(expense))}</p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {[
          { l: "Receita", icon: ArrowDownLeft, on: () => openQuickAdd({ type: "transaction", kind: "income" }) },
          { l: "Despesa", icon: ArrowUpRight, on: () => openQuickAdd({ type: "transaction", kind: "expense" }) },
          { l: "Transferir", icon: ArrowLeftRight, on: () => openQuickAdd({ type: "transfer" }) },
        ].map((b) => (
          <button
            key={b.l}
            onClick={b.on}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] py-2.5 text-[12.5px] font-medium transition hover:bg-white/15 active:scale-[0.98]"
          >
            <b.icon className="size-3.5" /> {b.l}
          </button>
        ))}
      </div>
    </div>
  );
}
