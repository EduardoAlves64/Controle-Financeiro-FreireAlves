"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useAppData } from "@/components/providers/app-data";
import { signOut } from "@/lib/actions/settings";

export function UserMenu() {
  const { me } = useAppData();
  const { setTheme, theme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownTrigger className="flex items-center gap-2 rounded-full outline-none ring-primary/30 focus-visible:ring-4">
        <UserAvatar name={me.full_name} src={me.avatar_url} className="size-9" />
      </DropdownTrigger>
      <DropdownContent className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <UserAvatar name={me.full_name} src={me.avatar_url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.full_name}</p>
            <p className="text-xs text-muted-foreground">{me.role === "owner" ? "Titular" : "Membro"}</p>
          </div>
        </div>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/configuracoes"><UserRound /> Meu perfil</Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/configuracoes?aba=preferencias"><Settings /> Configurações</Link>
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>Tema</DropdownLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {[
            { v: "light", icon: Sun, l: "Claro" },
            { v: "dark", icon: Moon, l: "Escuro" },
            { v: "system", icon: Monitor, l: "Auto" },
          ].map(({ v, icon: Icon, l }) => (
            <button
              key={v}
              onClick={() => setTheme(v)}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${theme === v ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-2"}`}
            >
              <Icon className="size-4" /> {l}
            </button>
          ))}
        </div>
        <DropdownSeparator />
        <DropdownItem destructive onSelect={() => void signOut()}>
          <LogOut /> Sair
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}
