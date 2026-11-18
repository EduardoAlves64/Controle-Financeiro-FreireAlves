"use client";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/ui/avatar";
import { useAppData } from "@/components/providers/app-data";
import { cn } from "@/lib/utils";

/** Seletor de responsável (pílulas com avatar) */
export function OwnerPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { members, userId } = useAppData();
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <button
          key={m.user_id}
          type="button"
          onClick={() => onChange(m.user_id)}
          className={cn(
            "flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-[13px] font-medium transition",
            value === m.user_id ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-2",
          )}
        >
          <UserAvatar name={m.full_name} src={m.avatar_url} className="size-6 ring-0" />
          {m.user_id === userId ? "Eu" : m.full_name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

export function ScopePicker({ value, onChange }: { value: "individual" | "shared"; onChange: (v: "individual" | "shared") => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          { v: "individual", t: "Individual", d: "Só de quem é responsável" },
          { v: "shared", t: "Compartilhada", d: "Do casal" },
        ] as const
      ).map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition",
            value === o.v ? "border-primary bg-primary-soft" : "hover:bg-surface-2",
          )}
        >
          <p className={cn("text-[13px] font-semibold", value === o.v && "text-primary")}>{o.t}</p>
          <p className="text-[11.5px] text-muted-foreground">{o.d}</p>
        </button>
      ))}
    </div>
  );
}

export function PrivacyToggle({
  value,
  onChange,
  disabled,
}: {
  value: "household" | "private";
  onChange: (v: "household" | "private") => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-3", disabled && "opacity-50")}>
      <span className="flex items-center gap-3">
        <Lock className="size-4 text-muted-foreground" />
        <span>
          <span className="block text-[13px] font-medium">Privado</span>
          <span className="block text-[11.5px] text-muted-foreground">Somente o responsável consegue ver</span>
        </span>
      </span>
      <Switch disabled={disabled} checked={value === "private"} onCheckedChange={(c) => onChange(c ? "private" : "household")} />
    </label>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-subtle-foreground">{children}</p>;
}
