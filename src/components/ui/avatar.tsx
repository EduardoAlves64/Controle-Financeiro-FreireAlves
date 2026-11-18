"use client";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials } from "@/lib/utils";

const PALETTE = ["#4969E8", "#E08A2E", "#16A36A", "#7C5CE0", "#D946A8", "#0EA5A4"];
function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative inline-flex size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-surface", className)}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        delayMs={src ? 400 : 0}
        className="flex size-full items-center justify-center text-[0.8em] font-semibold text-white"
        style={{ background: colorFor(name) }}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
