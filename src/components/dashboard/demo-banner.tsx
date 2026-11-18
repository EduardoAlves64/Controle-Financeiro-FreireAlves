"use client";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { clearDemoData } from "@/lib/actions/settings";

export function DemoBanner() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2.5 text-[13px]">
        <FlaskConical className="size-4 shrink-0 text-warning" />
        <span>
          <strong className="font-semibold">Modo demonstração.</strong> Os dados exibidos são fictícios e servem apenas para explorar o app.
        </span>
      </p>
      <ConfirmDialog
        title="Limpar dados de demonstração?"
        description="Todas as contas, cartões, movimentações, dívidas e metas fictícias serão removidas. Seus dados reais não são afetados."
        confirmLabel="Limpar e começar"
        destructive
        onConfirm={async () => {
          const r = await clearDemoData();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.refresh();
        }}
        trigger={<Button size="sm" variant="outline">Limpar e começar de verdade</Button>}
      />
    </div>
  );
}
