import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateApiKey, extractBearerToken, touchApiKeyLastUsed } from "@/lib/auth/api-auth";
import { generateShortId } from "@/lib/qr/id";
import { generateQrDataUrl } from "@/lib/qr/generate";
import { consumeApiKeyRate } from "@/lib/rate-limit/api-key-memory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const qrcodeCreateSchema = z.object({
  target_url: z.string().url("target_url muss eine gültige URL sein."),
  label: z.string().max(200).optional(),
  campaign: z.string().max(200).optional(),
  color: z.string().max(50).optional(),
  logo_url: z.string().url().optional(),
});

type SessionCtx = { kind: "session"; userId: string; supabase: SupabaseClient };
type ApiKeyCtx = { kind: "api_key"; userId: string; apiKeyId: string; admin: SupabaseClient };
type AuthCtx = SessionCtx | ApiKeyCtx;

async function resolveAuth(req: Request): Promise<
  | { ok: true; ctx: AuthCtx }
  | { ok: false; response: NextResponse }
> {
  if (extractBearerToken(req)) {
    const auth = await authenticateApiKey(req);
    if (!auth) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Ungültiger API-Key" }, { status: 401 }),
      };
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "API-Zugriff nicht konfiguriert: SUPABASE_SERVICE_ROLE_KEY fehlt (für serverseitige Writes nötig).",
          },
          { status: 503 },
        ),
      };
    }
    try {
      const admin = createSupabaseAdminClient();
      return {
        ok: true,
        ctx: { kind: "api_key", userId: auth.userId, apiKeyId: auth.apiKeyId, admin },
      };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Supabase Admin-Client konnte nicht erstellt werden." },
          { status: 503 },
        ),
      };
    }
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, ctx: { kind: "session", userId: user.id, supabase } };
}

function dbForCtx(ctx: AuthCtx): SupabaseClient {
  return ctx.kind === "session" ? ctx.supabase : ctx.admin;
}

export async function GET(req: Request) {
  const resolved = await resolveAuth(req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;

  if (ctx.kind === "api_key") {
    const rl = consumeApiKeyRate(ctx.apiKeyId);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        },
      );
    }
  }

  const db = dbForCtx(ctx);
  const { data, error } = await db
    .from("qr_codes")
    .select("id,target_url,label,campaign,color,logo_url,is_active,created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (ctx.kind === "api_key") {
    touchApiKeyLastUsed(ctx.apiKeyId);
  }

  return NextResponse.json({ qrCodes: data ?? [] });
}

export async function POST(req: Request) {
  const resolved = await resolveAuth(req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;

  if (ctx.kind === "api_key") {
    const rl = consumeApiKeyRate(ctx.apiKeyId);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        },
      );
    }
  }

  const db = dbForCtx(ctx);

  const { data: subscription } = await db
    .from("subscriptions")
    .select("plan")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const plan = subscription?.plan ?? "FREE";

  const { data: usageLimits } = await db
    .from("usage_limits")
    .select("qr_code_limit")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const fallbackQrCodeLimit = plan === "STARTER" ? 50 : plan === "PRO" ? 200 : 10;
  const qrCodeLimit = usageLimits?.qr_code_limit ?? fallbackQrCodeLimit;

  const { count, error: countError } = await db
    .from("qr_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
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

  let lastInsertErrorMessage: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateShortId(12);
    const shortPath = `/q/${id}`;
    const shortUrl = `${base}${shortPath}`;

    const insertPayload = {
      id,
      user_id: ctx.userId,
      project_id: null,
      target_url: parsed.data.target_url,
      label: parsed.data.label ?? null,
      campaign: parsed.data.campaign ?? null,
      color: parsed.data.color ?? null,
      logo_url: parsed.data.logo_url ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await db.from("qr_codes").insert(insertPayload);

    if (insertError) {
      lastInsertErrorMessage = insertError.message;
      continue;
    }

    const qrImageUrl = await generateQrDataUrl(shortUrl, 256);

    if (ctx.kind === "api_key") {
      touchApiKeyLastUsed(ctx.apiKeyId);
    }

    return NextResponse.json({
      id,
      shortUrl,
      shortPath,
      qrImageUrl,
    });
  }

  return NextResponse.json(
    {
      error: "Konnte nach mehreren Versuchen keinen QR-Code erstellen.",
      details: lastInsertErrorMessage,
    },
    { status: 409 },
  );
}
