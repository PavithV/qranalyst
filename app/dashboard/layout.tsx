import type { ReactNode } from "react";
import Link from "next/link";

import { redirect } from "next/navigation";
import { Code2, CreditCard, LayoutDashboard, QrCode } from "lucide-react";

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
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <h1 className="text-lg font-semibold">Konfiguration fehlt</h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <h1 className="text-lg font-semibold">Provisioning fehlgeschlagen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Beim Initialisieren der Supabase-Tabellen ist ein Fehler aufgetreten. Schau in die Vercel
            Deployment Logs nach der konkreten Exception.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" />
              Übersicht
            </Link>
            <Link
              href="/dashboard/billing"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CreditCard className="size-4" />
              Billing
            </Link>
            <Link
              href="/dashboard/developer"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Code2 className="size-4" />
              Entwickler
            </Link>
            <span className="ml-auto inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              <QrCode className="size-3.5" />
              Secure dashboard area
            </span>
          </nav>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 shadow-sm md:p-6">{children}</div>
      </div>
    </div>
  );
}

