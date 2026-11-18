"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { DebtForm } from "./debt-form";

export function NewDebtButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> Nova dívida</Button>
      <Sheet open={open} onOpenChange={setOpen} title="Nova dívida" description="As parcelas são geradas automaticamente.">
        {open && <DebtForm onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}
