import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Ohne Supabase-Konfiguration nie auth-lastig redirecten (damit Build/Dev nicht hart crasht).
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Next erwartet ein Cookie-Options-Objekt; Supabase liefert dafür ein kompatibles Set.
          (res.cookies as unknown as {
            set: (key: string, val: string, cookie?: unknown) => void;
          }).set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // Matcher deckt nur `/dashboard/:path*` ab, aber wir schützen defensiv.
  if (!user && req.nextUrl.pathname.startsWith("/dashboard")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

