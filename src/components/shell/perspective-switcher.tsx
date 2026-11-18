"use client";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { HeartHandshake, User, Users } from "lucide-react";
import { useAppData } from "@/components/providers/app-data";
import { setPerspective } from "@/lib/actions/settings";
import { firstName, cn } from "@/lib/utils";
import type { Perspective } from "@/lib/perspective";

export function PerspectiveSwitcher({ className }: { className?: string }) {
  const { perspective, partner } = useAppData();
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(perspective);

  const options: { value: Perspective; label: string; icon: typeof Users }[] = [
    { value: "all", label: "Família", icon: Users },
    { value: "shared", label: "Do casal", icon: HeartHandshake },
    { value: "me", label: "Só eu", icon: User },
    ...(partner ? [{ value: "partner" as const, label: `Só ${firstName(partner.full_name)}`, icon: User }] : []),
  ];

  return (
    <div className={cn("inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-1 scrollbar-none", className)} role="tablist" aria-label="Perspectiva financeira">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={optimistic === o.value}
          onClick={() =>
            start(async () => {
              setOptimistic(o.value);
              await setPerspective(o.value);
              router.refresh();
            })
          }
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 sm:px-3 text-[12.5px] font-medium text-muted-foreground transition-all",
            optimistic === o.value && "bg-surface text-foreground shadow-card",
          )}
        >
          <o.icon className="hidden size-3.5 sm:block" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
