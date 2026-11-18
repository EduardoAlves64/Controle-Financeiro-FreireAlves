import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Configuração necessária" };

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Falta conectar o Supabase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O app precisa das variáveis de ambiente do Supabase para funcionar. Configure-as e reinicie o servidor (ou faça um
        novo deploy).
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
        <li>Crie um projeto em supabase.com e rode as migrations da pasta <code>supabase/migrations</code>.</li>
        <li>
          Copie <code>.env.example</code> para <code>.env.local</code> e preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>Na Vercel, cadastre as mesmas variáveis em Settings › Environment Variables.</li>
      </ol>
      <p className="mt-6 text-sm text-muted-foreground">O passo a passo completo está no README do projeto.</p>
    </main>
  );
}
