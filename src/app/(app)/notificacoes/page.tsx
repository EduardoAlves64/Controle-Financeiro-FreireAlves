import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { NotificationsList } from "@/components/settings/notifications-list";
import { getNotifications } from "@/lib/data/queries";

export const metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const items = await getNotifications(100);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notificações"
        description={<>Alertas gerados automaticamente. Escolha quais receber em <Link href="/configuracoes?aba=notificacoes" className="text-primary hover:underline">Configurações</Link>.</>}
      />
      <NotificationsList items={items} />
    </div>
  );
}
