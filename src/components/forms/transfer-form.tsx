"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useAppData } from "@/components/providers/app-data";
import { createTransfer } from "@/lib/actions/accounts";
import { todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export function TransferForm({ onDone, fromId }: { onDone: () => void; fromId?: string }) {
  const { accounts } = useAppData();
  const active = accounts.filter((a) => !a.archived_at);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    from_account_id: fromId ?? active[0]?.id ?? "",
    to_account_id: active.find((a) => a.id !== (fromId ?? active[0]?.id))?.id ?? "",
    amount: 0,
    date: todayISO(),
    description: "",
  });
  const label = (id: string) => {
    const a = active.find((x) => x.id === id);
    return a ? `${a.name}${a.institution ? ` · ${a.institution}` : ""} (${formatBRL(a.balance)})` : "";
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createTransfer(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          onDone();
          router.refresh();
        });
      }}
    >
      <MoneyInput size="xl" autoFocus value={v.amount} onChange={(amount) => setV({ ...v, amount })} aria-label="Valor" />
      <div className="relative flex flex-col gap-3">
        <Field label="De">
          <Select value={v.from_account_id} onChange={(e) => setV({ ...v, from_account_id: e.target.value })}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>{label(a.id)}</option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
            <ArrowDown className="size-4" />
          </span>
        </div>
        <Field label="Para">
          <Select value={v.to_account_id} onChange={(e) => setV({ ...v, to_account_id: e.target.value })}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>{label(a.id)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <Input placeholder="Opcional" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
      </div>
      <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
        Transferências movem dinheiro entre contas e não contam como receita nem despesa.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="flex-[2]" loading={pending} disabled={active.length < 2}>Transferir</Button>
      </div>
    </form>
  );
}
