import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-[9px]", className)}
      style={{ background: "linear-gradient(135deg, #6D87F6 0%, #2F49C9 100%)" }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-[78%]">
        <circle cx="12.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" opacity="0.95" />
        <circle cx="19.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" opacity="0.7" />
      </svg>
    </span>
  );
}

export function Logo({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">Finance Hub</p>
        {subtitle && <p className="max-w-40 truncate text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
