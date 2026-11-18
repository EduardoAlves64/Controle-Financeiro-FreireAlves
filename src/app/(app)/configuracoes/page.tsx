import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { getAppContext } from "@/lib/data/context";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  return (
    <div>
      <PageHeader title="Configurações" description="Perfil, núcleo familiar, categorias, alertas, dados e segurança." />
      <Suspense>
        <SettingsView
          email={ctx.email}
          theme={ctx.profile.theme}
          prefs={ctx.profile.notification_prefs ?? {}}
          inviteCode={ctx.household.invite_code}
          hasDemoData={ctx.hasDemoData}
        />
      </Suspense>
    </div>
  );
}
