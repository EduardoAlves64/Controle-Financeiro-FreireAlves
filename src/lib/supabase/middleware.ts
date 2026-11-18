import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha", "/auth", "/configurar"];

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!url || !anonKey) {
    if (path.startsWith("/configurar")) return NextResponse.next();
    return NextResponse.redirect(new URL("/configurar", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida o token no servidor do Supabase (não confia só no cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const to = new URL("/login", request.url);
    if (path !== "/") to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (user && (path === "/login" || path === "/cadastro")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}
