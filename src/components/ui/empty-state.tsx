import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </div>
      <p className="text-[15px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-balance">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
