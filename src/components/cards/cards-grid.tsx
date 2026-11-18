"use client";
import Link from "next/link";
import { useState } from "react";
import { CreditCard as CardIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/components/providers/app-data";
import { CardVisual } from "./card-visual";
import { CardForm } from "./card-form";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { CreditCard } from "@/lib/types";

export interface CardSummary {
  card: CreditCard;
  used: number;
  available: number;
  currentTotal: number;
  currentDue: string | null;
  currentStatus: string | null;
}

export function CardsGrid({ items }: { items: CardSummary[] }) {
  const app = useAppData();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus /> Novo cartão</Button>
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={CardIcon} title="Nenhum cartão cadastrado" description="Cadastre seus cartões para acompanhar faturas, limite e compras parceladas." /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map(({ card, used, available, currentTotal, currentDue, currentStatus }) => {
            const pct = Number(card.credit_limit) ? (used / Number(card.credit_limit)) * 100 : 0;
            return (
              <Link key={card.id} href={`/cartoes/${card.id}`} className="group">
                <Card className="overflow-hidden p-4 transition group-hover:shadow-elevated">
                  <CardVisual name={card.name} bank={card.bank} brand={card.brand} last4={card.last4} color={card.color} holder={app.memberName(card.owner_id)} className="transition group-hover:-translate-y-0.5" />
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[12px] text-muted-foreground">Fatura atual</p>
                      <p className="text-xl font-semibold tabular">{formatBRL(currentTotal)}</p>
                    </div>
                    <div className="text-right text-[12px] text-muted-foreground">
                      {currentDue && <p>Vence {formatDate(currentDue, "dd/MM")}</p>}
                      {currentStatus && (
                        <Badge variant={currentStatus === "overdue" ? "negative" : currentStatus === "closed" ? "warning" : currentStatus === "paid" ? "positive" : "primary"}>
                          {{ open: "Aberta", closed: "Fechada", overdue: "Vencida", paid: "Paga", empty: "Sem compras" }[currentStatus]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground">
                      <span>Limite usado <strong className="text-foreground tabular">{formatBRL(used)}</strong></span>
                      <span>Disponível <strong className="text-positive tabular">{formatBRL(available)}</strong></span>
                    </div>
                    <Progress value={pct} tone={pct > 90 ? "danger" : pct > 70 ? "warning" : "default"} />
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      Fecha dia {card.closing_day} · vence dia {card.due_day} · melhor dia de compra: {card.closing_day}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen} title="Novo cartão">
        {open && <CardForm onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}
