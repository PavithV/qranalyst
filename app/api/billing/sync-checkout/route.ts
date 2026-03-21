import { NextResponse } from "next/server";
import { z } from "zod";

import { reconcileCheckoutSessionFromStripe } from "@/lib/stripe/reconcile-checkout-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(10),
});

/**
 * Client kann nach Checkout die session_id senden, falls der Server-Render die Query nicht sah.
 */
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const result = await reconcileCheckoutSessionFromStripe({
    sessionId: parsed.data.sessionId,
    expectedUserId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
