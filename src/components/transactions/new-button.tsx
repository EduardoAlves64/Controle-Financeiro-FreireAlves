"use client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/providers/app-data";

export function NewTransactionButton({ kind, label = "Nova movimentação" }: { kind?: "income" | "expense"; label?: string }) {
  const { openQuickAdd } = useAppData();
  return (
    <Button onClick={() => openQuickAdd(kind ? { type: "transaction", kind } : undefined)} className="hidden md:inline-flex">
      <Plus /> {label}
    </Button>
  );
}
