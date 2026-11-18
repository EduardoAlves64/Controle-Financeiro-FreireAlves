"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useAppData } from "@/components/providers/app-data";
import { PerspectiveSwitcher } from "./perspective-switcher";
import { UserMenu } from "./user-menu";

export function Topbar() {
  const { unread } = useAppData();
  return (
    <header className="no-print glass sticky top-0 z-30 border-b border-border/70">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 md:px-8">
        <Link href="/" className="md:hidden" aria-label="Início">
          <LogoMark className="size-8" />
        </Link>
        <PerspectiveSwitcher className="min-w-0" />
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/notificacoes"
            className="relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}
          >
            <Bell className="size-[19px]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-background">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
