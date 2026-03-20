import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr/generate";

export const dynamic = "force-dynamic";

const qrIdSchema = z.string().min(4).max(64);

const qrCodePatchSchema = z
  .object({
    target_url: z.string().url().optional(),
    label: z.string().max(200).nullable().optional(),
    campaign: z.string().max(200).nullable().optional(),
    color: z.string().max(50).nullable().optional(),
    logo_url: z.string().url().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Mindestens ein Feld muss geändert werden.",
  });

async function getUserOrUnauthorized(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

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
  const user = await getUserOrUnauthorized(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("qr_codes")
    .select("id,target_url,label,campaign,color,logo_url,is_active,created_at")
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "QR-Code nicht gefunden." }, { status: 404 });

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const shortPath = `/q/${data.id}`;
  const shortUrl = appUrl ? `${appUrl}${shortPath}` : shortPath;
  const qrImageUrl = await generateQrDataUrl(shortUrl, 256);

  return NextResponse.json({
    qrCode: data,
    shortPath,
    shortUrl,
    qrImageUrl,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsedId = qrIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Ungültige QR-ID" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsedBody = qrCodePatchSchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Ungültige Daten." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const user = await getUserOrUnauthorized(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updatePayload = {
    ...parsedBody.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("qr_codes")
    .update(updatePayload)
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id,target_url,label,campaign,color,logo_url,is_active,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "QR-Code nicht gefunden." }, { status: 404 });

  return NextResponse.json({ qrCode: data });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsedId = qrIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Ungültige QR-ID" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const user = await getUserOrUnauthorized(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("qr_codes")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "QR-Code nicht gefunden." }, { status: 404 });

  return NextResponse.json({ success: true });
}

