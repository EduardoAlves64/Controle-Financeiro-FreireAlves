"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/providers/app-data";
import { cn } from "@/lib/utils";
import { FOOTER_NAV, isActive, NAV_GROUPS, type NavItem } from "./nav-items";

function NavLink({ item, badge }: { item: NavItem; badge?: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
        active && "bg-surface text-foreground shadow-card ring-1 ring-border",
      )}
    >
      <Icon className={cn("size-[18px] transition-colors", active ? "text-primary" : "text-subtle-foreground group-hover:text-foreground")} />
      <span className="flex-1">{item.label}</span>
      {!!badge && (
        <span className="rounded-full bg-primary px-1.5 py-px text-[10.5px] font-semibold text-primary-foreground tabular">{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { householdName, unread, openQuickAdd } = useAppData();
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-background px-3 py-5 md:flex">
      <div className="px-2">
        <Logo subtitle={householdName} />
      </div>
      <Button className="mx-1 mt-6" onClick={() => openQuickAdd()}>
        <Plus /> Nova movimentação
      </Button>
      <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto scrollbar-none">
        {NAV_GROUPS.map((g, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {g.label && <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">{g.label}</p>}
            {g.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-border pt-3">
        {FOOTER_NAV.map((item) => (
          <NavLink key={item.href} item={item} badge={item.href === "/notificacoes" ? unread : undefined} />
        ))}
      </div>
    </aside>
  );
}
