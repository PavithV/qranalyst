import { NextResponse } from "next/server";

import { getSubscriptionForUser } from "@/lib/billing/get-subscription-for-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await getSubscriptionForUser(user.id);

  const { data: usage_limits } = await supabase
    .from("usage_limits")
    .select("qr_code_limit,monthly_scan_limit,analytics_retention_days")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    plan: subscription?.plan ?? "FREE",
    subscriptionStatus: subscription?.status ?? null,
    usageLimits: usage_limits ?? null,
  });
}

