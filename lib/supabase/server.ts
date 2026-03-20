import { createServerClient } from "@supabase/ssr";

import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Fehlende Umgebungsvariablen: NEXT_PUBLIC_SUPABASE_URL und/oder NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  // Hinweis: Token-Refresh und Cookie-Updates werden in dieser App über `middleware.ts` gehandhabt.
  // Für serverseitige Reads (z.B. `getUser`) reicht daher `getAll`.
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: async () => {
        const cookieStore = await cookies();
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
    },
  });
}

