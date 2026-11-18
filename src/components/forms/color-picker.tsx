"use client";
import { Check } from "lucide-react";
import { COLOR_SWATCHES } from "@/lib/constants";

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition hover:scale-105"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
          aria-label={`Cor ${c}`}
        >
          {value === c && <Check className="size-4 text-white" />}
        </button>
      ))}
    </div>
  );
}
