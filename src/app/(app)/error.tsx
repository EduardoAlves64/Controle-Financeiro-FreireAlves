"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-negative-soft text-negative"><AlertTriangle className="size-5" /></div>
      <h2 className="text-lg font-semibold">Algo deu errado</h2>
      <p className="mt-1 text-sm text-muted-foreground">Não foi possível carregar esta página. Tente novamente em instantes.</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-subtle-foreground">Código: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>Tentar novamente</Button>
    </Card>
  );
}
