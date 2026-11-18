import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <LoginForm next={sp.next} notice={sp.conta === "excluida" ? "Sua conta foi encerrada." : sp.erro ? "Não foi possível carregar seu núcleo familiar. Entre novamente." : undefined} />;
}
