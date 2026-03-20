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
    },
    { onConflict: "user_id" },
  );

  return <>{children}</>;
}

