import { Nfc } from "lucide-react";
import { cn } from "@/lib/utils";

const BRAND: Record<string, string> = { visa: "VISA", mastercard: "mastercard", elo: "elo", amex: "AMEX", hipercard: "Hipercard", other: "" };

export function CardVisual({
  name,
  bank,
  brand,
  last4,
  holder,
  color,
  className,
  compact,
}: {
  name: string;
  bank?: string | null;
  brand: string;
  last4?: string | null;
  holder?: string;
  color: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("relative aspect-[1.586] w-full overflow-hidden rounded-[20px] p-5 text-white shadow-elevated", className)}
      style={{
        background: `radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, ${color} 40%, #7dd3fc) 0%, transparent 50%),
          radial-gradient(90% 90% at 0% 100%, color-mix(in srgb, ${color} 50%, #2dd4bf) 0%, transparent 55%),
          linear-gradient(140deg, color-mix(in srgb, ${color} 85%, #000) 0%, ${color} 60%, color-mix(in srgb, ${color} 70%, #fff) 130%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.12)_50%,transparent_60%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">{bank ?? "Cartão"}</p>
            <p className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>{name}</p>
          </div>
          <p className={cn("font-bold italic tracking-tight", brand === "mastercard" ? "text-sm not-italic" : "text-lg")}>
            {brand === "mastercard" ? (
              <span className="flex items-center">
                <span className="size-6 rounded-full bg-[#EB001B]/90" />
                <span className="-ml-2.5 size-6 rounded-full bg-[#F79E1B]/90 mix-blend-screen" />
              </span>
            ) : (
              BRAND[brand]
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-9 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-400/80 shadow-inner" />
          <Nfc className="size-5 text-white/70" />
        </div>
        <div className="flex items-end justify-between">
          <div>
            {holder && <p className="text-[10px] uppercase tracking-wider text-white/60">Titular</p>}
            <p className="text-[13px] font-medium">{holder}</p>
          </div>
          <p className="font-mono text-[13px] tracking-[0.18em] text-white/90">•••• {last4 ?? "0000"}</p>
        </div>
      </div>
    </div>
  );
}
