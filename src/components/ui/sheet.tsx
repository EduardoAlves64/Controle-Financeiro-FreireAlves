"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Painel responsivo: painel lateral no desktop e bottom sheet no mobile.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
          <Dialog.Content
            className={cn(
              "fixed inset-y-3 right-3 z-50 flex w-[min(480px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-elevated outline-none data-[state=open]:animate-[slide-in_0.35s_cubic-bezier(0.16,1,0.3,1)]",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{String(title)}</Dialog.Description>
                )}
              </div>
              <Dialog.Close className="-mr-2 rounded-lg p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground">
                <X className="size-4" />
                <span className="sr-only">Fechar</span>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="border-t border-border bg-surface px-6 py-4">{footer}</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[28px] border-t border-border bg-surface outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" />
          <div className="px-5 pb-2 pt-4">
            <Drawer.Title className="text-lg font-semibold tracking-tight">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{String(title)}</Drawer.Description>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
          {footer && <div className="safe-bottom border-t border-border px-5 pb-3 pt-3">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
