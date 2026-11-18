"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, ArrowLeftRight, Lock, MoreHorizontal, Pencil, Plus, Scale, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useAppData } from "@/components/providers/app-data";
import { TransferForm } from "@/components/forms/transfer-form";
import { AccountForm } from "./account-form";
import { archiveAccount, deleteTransfer, reconcileAccount } from "@/lib/actions/accounts";
import { ACCOUNT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Account, Transfer } from "@/lib/types";

type Mode = { t: "new" } | { t: "edit"; a: Account } | { t: "reconcile"; a: Account } | { t: "transfer"; from?: string } | null;

export function AccountsManager({ accounts, archived, transfers }: { accounts: Account[]; archived: Account[]; transfers: Transfer[] }) {
  const { memberName, accounts: allAccounts } = useAppData();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [target, setTarget] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [pending, start] = useTransition();
  const close = () => setMode(null);
  const nameOf = (id: string) => [...allAccounts, ...archived].find((a) => a.id === id)?.name ?? "Conta";

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setMode({ t: "new" })}><Plus /> Nova conta</Button>
        <Button variant="outline" onClick={() => setMode({ t: "transfer" })} disabled={accounts.length < 2}><ArrowLeftRight /> Transferir</Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="Nenhuma conta cadastrada" description="Cadastre contas correntes, digitais, poupança, carteira e investimentos para acompanhar os saldos." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} className="group relative overflow-hidden p-5">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: a.color }} />
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ background: a.color }}>
                    <Wallet className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {a.name} {a.visibility === "private" && <Lock className="size-3 text-subtle-foreground" />}
                    </p>
                    <p className="truncate text-[12.5px] text-muted-foreground">{a.institution ?? ACCOUNT_TYPE_LABEL[a.type]}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Ações"><MoreHorizontal /></Button>
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem onSelect={() => setMode({ t: "edit", a })}><Pencil /> Editar</DropdownItem>
                    <DropdownItem onSelect={() => { setTarget(a.balance ?? 0); setMode({ t: "reconcile", a }); }}><Scale /> Conciliar saldo</DropdownItem>
                    <DropdownItem onSelect={() => setMode({ t: "transfer", from: a.id })}><ArrowLeftRight /> Transferir daqui</DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem
                      destructive
                      onSelect={() =>
                        start(async () => {
                          const r = await archiveAccount(a.id, true);
                          if (r.ok) toast.success(r.message); else toast.error(r.error);
                          router.refresh();
                        })
                      }
                    >
                      <Archive /> Arquivar
                    </DropdownItem>
                  </DropdownContent>
                </DropdownMenu>
              </div>
              <p className="mt-6 text-[12px] text-muted-foreground">Saldo atual</p>
              <p className={`text-2xl font-semibold tracking-tight tabular ${(a.balance ?? 0) < 0 ? "text-negative" : ""}`}>{formatBRL(a.balance)}</p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Badge variant={a.scope === "shared" ? "primary" : "neutral"}>{a.scope === "shared" ? "Casal" : memberName(a.owner_id)}</Badge>
                <Badge variant="outline">{ACCOUNT_TYPE_LABEL[a.type]}</Badge>
                {!a.include_in_total && <Badge variant="warning">Fora do total</Badge>}
                {a.is_demo && <Badge variant="warning">Demo</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="px-5 pt-5">
            <h3 className="text-[15px] font-semibold">Transferências recentes</h3>
            <p className="text-[13px] text-muted-foreground">Não contam como receita nem despesa</p>
          </div>
          <div className="p-3">
            {transfers.length ? (
              transfers.slice(0, 12).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><ArrowLeftRight className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{nameOf(t.from_account_id)} → {nameOf(t.to_account_id)}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{formatDate(t.date)}{t.description ? ` · ${t.description}` : ""}</p>
                  </div>
                  <p className="text-[14px] font-semibold tabular">{formatBRL(t.amount)}</p>
                  <ConfirmDialog
                    title="Excluir transferência?"
                    description="Os saldos das duas contas serão recalculados."
                    destructive
                    confirmLabel="Excluir"
                    onConfirm={async () => {
                      const r = await deleteTransfer(t.id);
                      if (r.ok) toast.success(r.message); else toast.error(r.error);
                      router.refresh();
                    }}
                    trigger={<Button variant="ghost" size="icon-sm" aria-label="Excluir"><Trash2 /></Button>}
                  />
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma transferência.</p>
            )}
          </div>
        </Card>
        {archived.length > 0 && (
          <Card>
            <div className="px-5 pt-5">
              <h3 className="text-[15px] font-semibold">Contas arquivadas</h3>
              <p className="text-[13px] text-muted-foreground">O histórico é preservado</p>
            </div>
            <div className="p-3">
              {archived.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="size-2.5 rounded-full" style={{ background: a.color }} />
                  <p className="flex-1 truncate text-[14px]">{a.name}</p>
                  <p className="text-[13px] tabular text-muted-foreground">{formatBRL(a.balance)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      start(async () => {
                        const r = await archiveAccount(a.id, false);
                        if (r.ok) toast.success(r.message); else toast.error(r.error);
                        router.refresh();
                      })
                    }
                  >
                    <ArchiveRestore /> Reativar
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Sheet open={mode?.t === "new" || mode?.t === "edit"} onOpenChange={(o) => !o && close()} title={mode?.t === "edit" ? "Editar conta" : "Nova conta"}>
        {(mode?.t === "new" || mode?.t === "edit") && <AccountForm initial={mode.t === "edit" ? mode.a : undefined} onDone={close} />}
      </Sheet>
      <Sheet open={mode?.t === "transfer"} onOpenChange={(o) => !o && close()} title="Transferência entre contas">
        {mode?.t === "transfer" && <TransferForm onDone={close} fromId={mode.from} />}
      </Sheet>
      <Sheet
        open={mode?.t === "reconcile"}
        onOpenChange={(o) => !o && close()}
        title="Conciliar saldo"
        description={mode?.t === "reconcile" ? `${mode.a.name} · saldo calculado ${formatBRL(mode.a.balance)}` : undefined}
      >
        {mode?.t === "reconcile" && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              start(async () => {
                const r = await reconcileAccount({ account_id: mode.a.id, target_balance: target, date });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                close();
                router.refresh();
              });
            }}
          >
            <Field label="Saldo real no banco" hint="Informe o saldo que aparece no app do banco. A diferença vira um ajuste identificado no extrato.">
              <MoneyInput size="xl" allowNegative value={target} onChange={setTarget} />
            </Field>
            <Field label="Data do ajuste">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
              Diferença: <strong className="tabular">{formatBRL(target - (mode.a.balance ?? 0), { signed: true })}</strong>
            </p>
            <Button type="submit" loading={pending}>Conciliar</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
