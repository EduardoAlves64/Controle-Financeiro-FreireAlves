"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "./button";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-elevated outline-none data-[state=open]:animate-slide-up">
          <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline">Cancelar</Button>
            </Dialog.Close>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
