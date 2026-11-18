import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsePerspective, PERSPECTIVE_COOKIE, type Perspective } from "@/lib/perspective";
import type { Category, Household, Member, Profile } from "@/lib/types";

export interface AppContext {
  userId: string;
  email: string;
  profile: Profile;
  household: Household;
  members: Member[];
  me: Member;
  partner: Member | null;
  categories: Category[];
  perspective: Perspective;
  hasDemoData: boolean;
}

/** Carrega (uma vez por requisição) usuário, núcleo familiar, membros e categorias. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, household_id, theme, notification_prefs")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile?.household_id) redirect("/login?erro=sem-familia");

  const hid = profile.household_id;
  const [householdRes, membersRes, profilesRes, categoriesRes, demoRes] = await Promise.all([
    supabase.from("households").select("id, name, invite_code").eq("id", hid).single<Household>(),
    supabase.from("household_members").select("user_id, role").eq("household_id", hid),
    supabase.from("profiles").select("id, full_name, avatar_url").eq("household_id", hid),
    supabase
      .from("transaction_categories")
      .select("id, name, kind, icon, color, is_system, archived_at")
      .eq("household_id", hid)
      .order("name"),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("household_id", hid).eq("is_demo", true),
  ]);

  const profiles = profilesRes.data ?? [];
  const members: Member[] = (membersRes.data ?? [])
    .map((m) => {
      const p = profiles.find((x) => x.id === m.user_id);
      return { user_id: m.user_id, role: m.role, full_name: p?.full_name ?? "Membro", avatar_url: p?.avatar_url ?? null };
    })
    .sort((a, b) => (a.user_id === user.id ? -1 : b.user_id === user.id ? 1 : 0));

  const me = members.find((m) => m.user_id === user.id) ?? {
    user_id: user.id,
    role: "owner" as const,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  };
  const partner = members.find((m) => m.user_id !== user.id) ?? null;
  const cookieStore = await cookies();
  let perspective = parsePerspective(cookieStore.get(PERSPECTIVE_COOKIE)?.value);
  if (perspective === "partner" && !partner) perspective = "all";

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    household: householdRes.data!,
    members,
    me,
    partner,
    categories: (categoriesRes.data ?? []) as Category[],
    perspective,
    hasDemoData: (demoRes.count ?? 0) > 0,
  };
});

export function memberName(ctx: Pick<AppContext, "members">, userId: string | null | undefined): string {
  return ctx.members.find((m) => m.user_id === userId)?.full_name.split(" ")[0] ?? "—";
}
