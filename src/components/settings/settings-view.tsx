"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import {
  Bell, Camera, Copy, Database, Download, FlaskConical, Globe, KeyRound, LogOut, Pencil, Plus, RefreshCw, Shapes,
  ShieldAlert, Trash2, UserRound, Users, ArchiveRestore, Archive,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/ui/avatar";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Segmented } from "@/components/ui/segmented";
import { CategoryIcon, ICON_OPTIONS } from "@/components/ui/category-icon";
import { ColorPicker } from "@/components/forms/color-picker";
import { useAppData } from "@/components/providers/app-data";
import { createClient } from "@/lib/supabase/client";
import {
  archiveCategory, clearDemoData, deleteMyAccount, joinHousehold, loadDemoData, regenerateInvite, saveCategory, signOut,
  updateAvatar, updateHousehold, updateNotificationPrefs, updateProfile,
} from "@/lib/actions/settings";
import { updatePassword } from "@/lib/actions/auth";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

const TABS = [
  { k: "perfil", l: "Perfil", i: UserRound },
  { k: "familia", l: "Núcleo familiar", i: Users },
  { k: "preferencias", l: "Preferências", i: Globe },
  { k: "categorias", l: "Categorias", i: Shapes },
  { k: "notificacoes", l: "Notificações", i: Bell },
  { k: "dados", l: "Dados", i: Database },
  { k: "seguranca", l: "Segurança", i: ShieldAlert },
] as const;
type Tab = (typeof TABS)[number]["k"];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function SettingsView({
  email,
  theme: savedTheme,
  prefs,
  inviteCode,
  hasDemoData,
}: {
  email: string;
  theme: "light" | "dark" | "system";
  prefs: Record<string, boolean>;
  inviteCode: string;
  hasDemoData: boolean;
}) {
  const app = useAppData();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = (TABS.some((t) => t.k === sp.get("aba")) ? sp.get("aba") : "perfil") as Tab;
  const setTab = (k: Tab) => router.replace(`${pathname}?aba=${k}`, { scroll: false });
  const [pending, start] = useTransition();
  const { setTheme } = useTheme();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      if (r.message) toast.success(r.message);
      after?.();
      router.refresh();
    });

  // ---- perfil ----
  const [name, setName] = useState(app.me.full_name);
  const [themeValue, setThemeValue] = useState(savedTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return toast.error("A imagem deve ter até 2 MB");
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${app.userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error("Falha no envio: " + error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    run(() => updateAvatar(data.publicUrl));
  };

  // ---- família ----
  const [householdName, setHouseholdName] = useState(app.householdName);
  const [code, setCode] = useState(inviteCode);
  const [joinCode, setJoinCode] = useState("");

  // ---- senha ----
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [deleteText, setDeleteText] = useState("");

  // ---- notificações ----
  const [notif, setNotif] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t.key, prefs[t.key] !== false])),
  );

  // ---- categorias ----
  const [catKind, setCatKind] = useState<"expense" | "income">("expense");
  const [catEdit, setCatEdit] = useState<Partial<Category> & { kind: "expense" | "income" } | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="no-print -mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:px-0">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition hover:bg-surface-2 hover:text-foreground",
              tab === t.k && "bg-surface text-foreground shadow-card ring-1 ring-border",
            )}
          >
            <t.i className="size-4" /> {t.l}
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        {tab === "perfil" && (
          <>
            <Section title="Dados pessoais" description="Como você aparece para o seu(sua) parceiro(a).">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <UserAvatar name={app.me.full_name} src={app.me.avatar_url} className="size-20 text-2xl" />
                  <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-primary-foreground" aria-label="Alterar foto">
                    <Camera className="size-4" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                </div>
                <div>
                  <p className="font-semibold">{app.me.full_name}</p>
                  <p className="text-[13px] text-muted-foreground">{email}</p>
                  {app.me.avatar_url && <button className="mt-1 text-[12px] text-negative hover:underline" onClick={() => run(() => updateAvatar(null))}>Remover foto</button>}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Tema">
                  <Select value={themeValue} onChange={(e) => { const v = e.target.value as typeof themeValue; setThemeValue(v); setTheme(v); }}>
                    <option value="system">Automático (sistema)</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </Select>
                </Field>
              </div>
              <Button className="mt-5" loading={pending} onClick={() => run(() => updateProfile({ full_name: name, theme: themeValue }))}>Salvar perfil</Button>
            </Section>
          </>
        )}

        {tab === "familia" && (
          <>
            <Section title="Perfil do casal" description="Nome do núcleo financeiro compartilhado.">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
                <Button loading={pending} onClick={() => run(() => updateHousehold({ name: householdName }))}>Salvar</Button>
              </div>
            </Section>
            <Section title="Membros" description="Cada pessoa tem seu próprio login e enxerga os dados compartilhados.">
              <ul className="flex flex-col gap-2">
                {app.members.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                    <UserAvatar name={m.full_name} src={m.avatar_url} />
                    <span className="flex-1 font-medium">{m.full_name}{m.user_id === app.userId && <span className="text-muted-foreground"> (você)</span>}</span>
                    <Badge variant={m.role === "owner" ? "primary" : "neutral"}>{m.role === "owner" ? "Titular" : "Membro"}</Badge>
                  </li>
                ))}
              </ul>
              {app.members.length < 2 && (
                <div className="mt-5 rounded-2xl bg-primary-soft p-4">
                  <p className="text-[13.5px] font-medium text-primary">Convide seu(sua) parceiro(a)</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Ao criar a conta, ele(a) informa este código e entra automaticamente neste núcleo familiar.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="rounded-xl bg-surface px-4 py-2 font-mono text-lg font-semibold tracking-[0.3em]">{code}</code>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/cadastro?convite=${code}`); toast.success("Link de convite copiado"); }}>
                      <Copy /> Copiar link
                    </Button>
                    {app.me.role === "owner" && (
                      <Button variant="ghost" size="sm" onClick={() => start(async () => { const r = await regenerateInvite(); if (r.ok && r.data) { setCode(r.data.code); toast.success(r.message); } else if (!r.ok) toast.error(r.error); })}>
                        <RefreshCw /> Gerar novo
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Section>
            {app.members.length < 2 && (
              <Section title="Entrar em outro núcleo" description="Se seu(sua) parceiro(a) já criou o núcleo, use o código dele(a). Atenção: os dados do seu núcleo atual serão descartados.">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input className="uppercase tracking-widest" placeholder="CÓDIGO" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                  <ConfirmDialog
                    title="Entrar em outro núcleo familiar?"
                    description="Seu núcleo atual e os dados dele serão apagados. Esta ação não pode ser desfeita."
                    confirmLabel="Entrar"
                    destructive
                    onConfirm={() => run(() => joinHousehold(joinCode))}
                    trigger={<Button disabled={joinCode.length < 6}>Entrar</Button>}
                  />
                </div>
              </Section>
            )}
          </>
        )}

        {tab === "preferencias" && (
          <Section title="Preferências financeiras" description="Padrões de exibição do aplicativo.">
            <dl className="divide-y divide-border rounded-2xl border border-border">
              {[
                ["Moeda padrão", "Real brasileiro (BRL)"],
                ["Idioma", "Português do Brasil"],
                ["Formato de data", "DD/MM/AAAA"],
                ["Formato monetário", "R$ 1.234,56"],
                ["Início da semana nos relatórios", "Segunda-feira"],
                ["Fuso horário", "Brasília (America/Sao_Paulo)"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 text-[13.5px]">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-muted-foreground">A perspectiva (Família, Do casal, Só eu) é escolhida no topo da tela e fica salva neste dispositivo.</p>
          </Section>
        )}

        {tab === "categorias" && (
          <Section title="Categorias personalizadas" description="Crie, renomeie, mude ícone/cor ou arquive categorias.">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Segmented value={catKind} onChange={setCatKind} options={[{ value: "expense", label: "Despesas" }, { value: "income", label: "Receitas" }]} />
              <Button size="sm" onClick={() => setCatEdit({ kind: catKind, name: "", icon: "circle", color: "#4969E8" })}><Plus /> Nova categoria</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {app.categories.filter((c) => c.kind === catKind).map((c) => (
                <div key={c.id} className={cn("flex items-center gap-3 rounded-xl border border-border px-3 py-2", c.archived_at && "opacity-50")}>
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="flex-1 truncate text-[13.5px] font-medium">{c.name}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setCatEdit({ ...c })}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={c.archived_at ? "Reativar" : "Arquivar"} onClick={() => run(() => archiveCategory(c.id, !c.archived_at))}>
                    {c.archived_at ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </div>
              ))}
            </div>
            <Sheet open={!!catEdit} onOpenChange={(o) => !o && setCatEdit(null)} title={catEdit?.id ? "Editar categoria" : "Nova categoria"}>
              {catEdit && (
                <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); run(() => saveCategory(catEdit), () => setCatEdit(null)); }}>
                  <div className="flex items-center gap-3">
                    <CategoryIcon icon={catEdit.icon} color={catEdit.color} size="lg" />
                    <Input value={catEdit.name ?? ""} placeholder="Nome" onChange={(e) => setCatEdit({ ...catEdit, name: e.target.value })} />
                  </div>
                  <Field label="Ícone">
                    <div className="flex flex-wrap gap-1.5">
                      {ICON_OPTIONS.map((i) => (
                        <button key={i} type="button" onClick={() => setCatEdit({ ...catEdit, icon: i })} className={cn("rounded-xl p-0.5 ring-2", catEdit.icon === i ? "ring-primary" : "ring-transparent")}>
                          <CategoryIcon icon={i} color={catEdit.color} size="sm" />
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Cor"><ColorPicker value={catEdit.color ?? "#4969E8"} onChange={(color) => setCatEdit({ ...catEdit, color })} /></Field>
                  <Button type="submit" loading={pending}>Salvar</Button>
                </form>
              )}
            </Sheet>
          </Section>
        )}

        {tab === "notificacoes" && (
          <Section title="Alertas no aplicativo" description="Escolha quais alertas você quer receber. Cada pessoa configura os seus.">
            <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
              {NOTIFICATION_TYPES.map((t) => (
                <label key={t.key} className="flex cursor-pointer items-center justify-between px-4 py-3">
                  <span className="text-[13.5px]">{t.label}</span>
                  <Switch checked={notif[t.key]} onCheckedChange={(c) => setNotif({ ...notif, [t.key]: c })} />
                </label>
              ))}
            </div>
            <Button className="mt-5" loading={pending} onClick={() => run(() => updateNotificationPrefs(notif))}>Salvar preferências</Button>
            <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] text-muted-foreground">
              E-mail e WhatsApp: a estrutura já está pronta (canal por notificação no banco). Para ativar, é necessário configurar um provedor (ex.: Resend para e-mail, Z-API/Twilio para WhatsApp) — veja a documentação do projeto.
            </p>
          </Section>
        )}

        {tab === "dados" && (
          <>
            <Section title="Dados de demonstração" description="Dados fictícios e realistas para explorar o app. Ficam marcados e podem ser removidos a qualquer momento, sem afetar seus dados reais.">
              {hasDemoData ? (
                <ConfirmDialog
                  title="Limpar dados de demonstração?"
                  description="Todas as contas, cartões, movimentações, dívidas, metas e orçamentos fictícios serão removidos."
                  confirmLabel="Limpar"
                  destructive
                  onConfirm={() => run(clearDemoData)}
                  trigger={<Button variant="outline"><Trash2 /> Limpar dados de demonstração</Button>}
                />
              ) : (
                <Button variant="outline" loading={pending} onClick={() => run(loadDemoData)}><FlaskConical /> Carregar dados de demonstração</Button>
              )}
            </Section>
            <Section title="Exportação de dados" description="Baixe todas as movimentações que você pode ver, em CSV (abre no Excel e Google Planilhas).">
              <Button asChild variant="outline"><a href="/api/exportar"><Download /> Exportar movimentações (CSV)</a></Button>
            </Section>
          </>
        )}

        {tab === "seguranca" && (
          <>
            <Section title="Alterar senha">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nova senha"><Input type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
                <Field label="Confirmar"><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              </div>
              <Button className="mt-4" loading={pending} onClick={() => run(() => updatePassword(pw), () => setPw({ password: "", confirm: "" }))}><KeyRound /> Alterar senha</Button>
            </Section>
            <Section title="Sessão" description="Encerre a sessão neste dispositivo.">
              <Button variant="outline" onClick={() => void signOut()}><LogOut /> Sair</Button>
            </Section>
            <Section title="Privacidade">
              <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-muted-foreground">
                <li>Os dados ficam no seu projeto Supabase, protegidos por regras de acesso (RLS) no próprio banco.</li>
                <li>Itens marcados como privados só são visíveis para o responsável.</li>
                <li>Operações sensíveis ficam registradas em um log de auditoria.</li>
              </ul>
            </Section>
            <Section title="Encerrar conta" description="Seus itens individuais passam para o(a) outro(a) membro. Se você for o único membro, todo o núcleo é apagado.">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input placeholder='Digite "EXCLUIR"' value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
                <ConfirmDialog
                  title="Encerrar sua conta definitivamente?"
                  description="Esta ação não pode ser desfeita."
                  confirmLabel="Encerrar conta"
                  destructive
                  onConfirm={() => run(() => deleteMyAccount(deleteText))}
                  trigger={<Button variant="danger" disabled={deleteText !== "EXCLUIR"}><Trash2 /> Encerrar conta</Button>}
                />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
