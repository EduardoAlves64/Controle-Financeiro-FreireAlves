"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CreditCard, LayoutDashboard, ListOrdered, Menu, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useAppData } from "@/components/providers/app-data";
import { cn } from "@/lib/utils";
import { ALL_NAV, isActive } from "./nav-items";

const TABS = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/movimentacoes", label: "Extrato", icon: ListOrdered },
  null,
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { openQuickAdd, unread } = useAppData();
  const [more, setMore] = useState(false);
  const inTabs = TABS.some((t) => t && isActive(pathname, t.href));

  return (
    <>
      <nav className="no-print glass fixed inset-x-0 bottom-0 z-40 border-t border-border safe-bottom md:hidden">
        <div className="grid h-16 grid-cols-5 items-center px-2">
          {TABS.map((t, i) =>
            t ? (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 text-[10.5px] font-medium text-muted-foreground transition-colors",
                  isActive(pathname, t.href) && "text-primary",
                )}
              >
                <t.icon className="size-[22px]" strokeWidth={isActive(pathname, t.href) ? 2.2 : 1.8} />
                {t.label}
              </Link>
            ) : (
              <div key={i} className="flex justify-center">
                <button
                  onClick={() => openQuickAdd()}
                  aria-label="Nova movimentação"
                  className="-mt-7 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-float transition active:scale-95"
                >
                  <Plus className="size-6" strokeWidth={2.4} />
                </button>
              </div>
            ),
          )}
          <button
            onClick={() => setMore(true)}
            className={cn(
              "relative flex flex-col items-center gap-1 py-1 text-[10.5px] font-medium text-muted-foreground",
              !inTabs && "text-primary",
            )}
          >
            <Menu className="size-[22px]" strokeWidth={1.8} />
            Mais
            {unread > 0 && <span className="absolute right-[30%] top-0.5 size-2 rounded-full bg-negative" />}
          </button>
        </div>
      </nav>
      <Sheet open={more} onOpenChange={setMore} title="Menu">
        <div className="grid grid-cols-3 gap-2.5 pb-2">
          {ALL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMore(false)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-2 py-4 text-center text-[12px] font-medium shadow-card active:scale-[0.98]",
                isActive(pathname, item.href) && "border-primary/40 bg-primary-soft text-primary",
              )}
            >
              <item.icon className="size-5" />
              {item.short ?? item.label}
              {item.href === "/notificacoes" && unread > 0 && (
                <span className="absolute right-2 top-2 rounded-full bg-negative px-1.5 text-[10px] text-white">{unread}</span>
              )}
            </Link>
          ))}
        </div>
      </Sheet>
    </>
  );
}
