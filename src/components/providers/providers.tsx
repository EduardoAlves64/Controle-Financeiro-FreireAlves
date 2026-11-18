"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import * as Tooltip from "@radix-ui/react-tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Tooltip.Provider delayDuration={200}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className: "!rounded-2xl !border-border !bg-surface !text-foreground !shadow-elevated !font-sans",
          }}
        />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}
