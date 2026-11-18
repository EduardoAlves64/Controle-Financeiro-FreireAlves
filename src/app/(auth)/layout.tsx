import { ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="hero-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
              <circle cx="12.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
              <circle cx="19.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" opacity="0.7" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">Finance Hub</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-balance">
            O dinheiro do casal, organizado do jeito certo.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Finanças individuais e compartilhadas, contas fixas, cartões, dívidas e metas — com relatórios semanais que
            mostram exatamente para onde o dinheiro está indo.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/85">
            {[
              { icon: Users, text: "Um login para cada um, um núcleo financeiro para os dois" },
              { icon: ShieldCheck, text: "Dados protegidos por regras de acesso no próprio banco" },
              { icon: Sparkles, text: "Análises calculadas a partir dos seus dados reais" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">© {new Date().getFullYear()} Finance Hub · Família Freire Alves</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
