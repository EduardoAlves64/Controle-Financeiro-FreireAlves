import {
  Bell, CalendarDays, CreditCard, HandCoins, LayoutDashboard, ListOrdered, PieChart, Repeat, Settings, Target, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Visão geral", short: "Início", icon: LayoutDashboard },
      { href: "/movimentacoes", label: "Movimentações", short: "Extrato", icon: ListOrdered },
    ],
  },
  {
    label: "Patrimônio",
    items: [
      { href: "/contas", label: "Contas e saldos", short: "Contas", icon: Wallet },
      { href: "/contas-fixas", label: "Contas fixas", icon: Repeat },
      { href: "/cartoes", label: "Cartões de crédito", short: "Cartões", icon: CreditCard },
      { href: "/dividas", label: "Dívidas", icon: HandCoins },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/metas", label: "Metas e orçamentos", short: "Metas", icon: Target },
      { href: "/calendario", label: "Calendário", icon: CalendarDays },
      { href: "/relatorios", label: "Relatórios", icon: PieChart },
    ],
  },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/notificacoes", label: "Notificações", icon: Bell },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
