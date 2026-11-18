import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="size-12" />
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O endereço pode ter mudado ou o item não existe mais.</p>
      <Link href="/" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Voltar ao início</Link>
    </main>
  );
}
