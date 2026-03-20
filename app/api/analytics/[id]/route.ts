import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getQrAnalytics } from "@/lib/analytics/get-qr-analytics";
import { posthogCapture } from "@/lib/posthog/capture";

export const dynamic = "force-dynamic";

const qrIdSchema = z.string().min(4).max(64);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsedId = qrIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Ungültige QR-ID" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: usageLimit } = await supabase
    .from("usage_limits")
    .select("analytics_retention_days")
    .eq("user_id", user.id)
    .maybeSingle();

  const retentionDays = usageLimit?.analytics_retention_days ?? 90;

  const analytics = await getQrAnalytics({
    supabase,
    qrCodeId: parsedId.data,
    retentionDays,
    maxEvents: 5000,
  });

  const { data: qr } = await supabase
    .from("qr_codes")
    .select("project_id,campaign")
    .eq("id", parsedId.data)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  void posthogCapture({
    event: "analytics_viewed",
    distinctId: user.id,
    properties: {
      user_id: user.id,
      project_id: qr?.project_id ?? null,
      qr_code_id: parsedId.data,
      campaign: qr?.campaign ?? null,
      plan: sub?.plan ?? "FREE",
      source: "dashboard",
    },
  });

  return NextResponse.json({ analytics });
}

