import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShortId } from "@/lib/qr/id";
import { generateQrDataUrl } from "@/lib/qr/generate";

export const dynamic = "force-dynamic";

const qrcodeCreateSchema = z.object({
  target_url: z.string().url("target_url muss eine gültige URL sein."),
  label: z.string().max(200).optional(),
  campaign: z.string().max(200).optional(),
  color: z.string().max(50).optional(),
  logo_url: z.string().url().optional(),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .select("id,target_url,label,campaign,color,logo_url,is_active,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ qrCodes: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();
  const plan = subscription?.plan ?? "FREE";

  // Enforce qr_code_limit before inserting a new QR record.
  const { data: usageLimits } = await supabase
    .from("usage_limits")
    .select("qr_code_limit")
    .eq("user_id", user.id)
    .maybeSingle();

  const fallbackQrCodeLimit = plan === "STARTER" ? 50 : plan === "PRO" ? 200 : 10;
  const qrCodeLimit = usageLimits?.qr_code_limit ?? fallbackQrCodeLimit;

  const { count, error: countError } = await supabase
    .from("qr_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (typeof count === "number" && count >= qrCodeLimit) {
    return NextResponse.json(
      { error: "QR-Code Limit erreicht. Upgrade erforderlich." },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = qrcodeCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben" },
      { status: 400 },
    );
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_URL fehlt (Environment Variable)." },
      { status: 500 },
    );
  }

  const base = appUrl.replace(/\/$/, "");

  // Kollisionen (sehr selten) ausgleichen.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateShortId(12);
    const shortPath = `/q/${id}`;
    const shortUrl = `${base}${shortPath}`;

    const insertPayload = {
      id,
      user_id: user.id,
      project_id: null,
      target_url: parsed.data.target_url,
      label: parsed.data.label ?? null,
      campaign: parsed.data.campaign ?? null,
      color: parsed.data.color ?? null,
      logo_url: parsed.data.logo_url ?? null,
    };

    const { error: insertError } = await supabase
      .from("qr_codes")
      .insert(insertPayload);

    if (insertError) {
      // Bei PK-Kollision: erneut versuchen.
      continue;
    }

    const qrImageUrl = await generateQrDataUrl(shortUrl, 256);

    return NextResponse.json({
      id,
      shortUrl,
      shortPath,
      qrImageUrl,
    });
  }

  return NextResponse.json(
    { error: "Konnte nach mehreren Versuchen keinen QR-Code erstellen." },
    { status: 409 },
  );
}

