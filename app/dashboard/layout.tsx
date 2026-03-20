import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Provisioning (profiles/limits/subscription) via Service Role.
  // Grund: RLS/Foreign Keys verlangen vorhandene Rows (qr_codes -> profiles).
  // In Vercel ist es sehr häufig, dass dieser Key noch fehlt.
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasServiceRoleKey) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto rounded-xl border bg-white p-4 text-zinc-800">
          <h1 className="text-lg font-semibold">Konfiguration fehlt</h1>
          <p className="text-sm text-zinc-600 mt-2">
            Bitte setze in Vercel unter <span className="font-mono">Settings → Environment Variables</span> die Variable{" "}
            <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>. Ohne sie kann das Dashboard
            nicht pro User initialisieren.
          </p>
        </div>
      </div>
    );
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "",
      },
      { onConflict: "id" },
    );

    await supabaseAdmin.from("usage_limits").upsert(
      {
        user_id: user.id,
        qr_code_limit: 10,
        monthly_scan_limit: 1000,
        analytics_retention_days: 90,
      },
      { onConflict: "user_id" },
    );

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: "FREE",
        status: "active",
        current_period_end: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto rounded-xl border bg-white p-4 text-zinc-800">
          <h1 className="text-lg font-semibold">Provisioning fehlgeschlagen</h1>
          <p className="text-sm text-zinc-600 mt-2">
            Beim Initialisieren der Supabase-Tabellen ist ein Fehler aufgetreten. Schau in die Vercel
            Deployment Logs nach der konkreten Exception.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

