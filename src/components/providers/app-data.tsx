"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Perspective } from "@/lib/perspective";
import type { Account, Category, CreditCard, Member, Transaction } from "@/lib/types";

export interface Suggestion {
  description: string;
  kind: "income" | "expense";
  category_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  payment_method: string | null;
  scope: "individual" | "shared";
}

export interface AppData {
  userId: string;
  householdId: string;
  householdName: string;
  members: Member[];
  me: Member;
  partner: Member | null;
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  perspective: Perspective;
  suggestions: Suggestion[];
  unread: number;
}

export type QuickAddMode =
  | { type: "chooser" }
  | { type: "transaction"; kind: "income" | "expense"; initial?: Partial<Transaction>; duplicate?: boolean }
  | { type: "transfer" };

interface Ctx extends AppData {
  quickAdd: QuickAddMode | null;
  openQuickAdd: (mode?: QuickAddMode) => void;
  closeQuickAdd: () => void;
  memberName: (id: string | null | undefined) => string;
  categoryById: (id: string | null | undefined) => Category | undefined;
}

const AppDataContext = createContext<Ctx | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  const [quickAdd, setQuickAdd] = useState<QuickAddMode | null>(null);
  const openQuickAdd = useCallback((mode: QuickAddMode = { type: "chooser" }) => setQuickAdd(mode), []);
  const closeQuickAdd = useCallback(() => setQuickAdd(null), []);
  const ctx = useMemo<Ctx>(
    () => ({
      ...value,
      quickAdd,
      openQuickAdd,
      closeQuickAdd,
      memberName: (id) => value.members.find((m) => m.user_id === id)?.full_name.split(" ")[0] ?? "—",
      categoryById: (id) => value.categories.find((c) => c.id === id),
    }),
    [value, quickAdd, openQuickAdd, closeQuickAdd],
  );
  return <AppDataContext.Provider value={ctx}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData fora do AppDataProvider");
  return ctx;
}
