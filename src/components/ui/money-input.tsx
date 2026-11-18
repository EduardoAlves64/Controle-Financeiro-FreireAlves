"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";
import { parseBRL } from "@/lib/money";

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Máscara monetária estilo app de banco: os dígitos digitados entram pelos centavos.
 * value/onChange trabalham com número em reais (ex.: 1234.56).
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  {
    value: number | undefined;
    onChange: (value: number) => void;
    size?: "md" | "xl";
    allowNegative?: boolean;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size">
>(({ value, onChange, size = "md", className, allowNegative, ...props }, ref) => {
  const cents = Math.round((value ?? 0) * 100);
  const negative = cents < 0;
  const display = fmt.format(Math.abs(cents) / 100);

  return (
    <div className="relative">
      <span
        className={cn(
          "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-medium text-muted-foreground",
          size === "xl" ? "text-xl" : "text-sm",
        )}
      >
        {negative ? "-R$" : "R$"}
      </span>
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        className={cn(
          fieldBase,
          "tabular text-right",
          size === "xl" ? "h-16 pl-14 text-3xl font-semibold tracking-tight" : "h-11 pl-10 md:h-10",
          className,
        )}
        value={display}
        onKeyDown={(e) => {
          if (allowNegative && e.key === "-") {
            e.preventDefault();
            onChange(-cents / 100);
          }
        }}
        onChange={(e) => {
          // Independe da posição do cursor: dígitos sempre entram pela direita (centavos)
          const ne = e.nativeEvent as InputEvent;
          const abs = Math.abs(cents);
          let next: number;
          if (ne.inputType?.startsWith("delete")) {
            next = Math.trunc(abs / 10);
          } else if (ne.inputType === "insertText" && ne.data) {
            const typed = ne.data.replace(/\D/g, "");
            if (!typed) return;
            next = Number(`${abs}${typed}`);
          } else if (ne.inputType === "insertFromPaste" || ne.inputType === "insertReplacementText") {
            const raw = e.target.value;
            next = /[.,]\d{1,2}$/.test(raw) ? Math.round(parseBRL(raw) * 100) : Number(raw.replace(/\D/g, "") || "0");
          } else {
            next = Number(e.target.value.replace(/\D/g, "") || "0");
          }
          if (next > 999_999_999_99) return;
          onChange(((negative ? -1 : 1) * next) / 100);
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        }}
        {...props}
      />
    </div>
  );
});
MoneyInput.displayName = "MoneyInput";
