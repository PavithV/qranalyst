import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { posthogCapture } from "@/lib/posthog/capture";

export const dynamic = "force-dynamic";

const qrIdRegex = /^[0-9a-zA-Z]{8,32}$/;

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function detectDeviceType(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "mobile";
  return "desktop";
}

function detectOsName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("linux")) return "Linux";
  return null;
}

function detectCountryCode(req: NextRequest): string | null {
  return (
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-country-code") ??
    null
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!qrIdRegex.test(id)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Public: Target-URL via SECURITY DEFINER function (works with anon).
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data: targetUrl, error: targetError } = await supabaseAnon.rpc(
    "get_qr_code_target_url",
    { p_qr_code_id: id },
  );

  if (targetError || !targetUrl) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const ipSource =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ipHash = sha256Hex(ipSource ?? "unknown");

  const userAgent = req.headers.get("user-agent");
  const referrer = req.headers.get("referer");
  const countryCode = detectCountryCode(req);
  const deviceType = detectDeviceType(userAgent);
  const osName = detectOsName(userAgent);

  // Insert scan event server-side (fire-and-forget).
  if (supabaseServiceRoleKey) {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Supabase-Insert liefert keinen Promise-Builder mit `.catch()`, daher
    // kapseln wir es in eine async-IIFE und "forgetten" den Promise.
    void (async () => {
      try {
        const { data: qrOwner } = await supabaseAdmin
          .from("qr_codes")
          .select("user_id,project_id,campaign")
          .eq("id", id)
          .maybeSingle();

        const userId = qrOwner?.user_id ?? null;

        const { data: sub } = userId
          ? await supabaseAdmin
              .from("subscriptions")
              .select("plan")
              .eq("user_id", userId)
              .maybeSingle()
          : { data: null };

        const plan = sub?.plan ?? "FREE";

        // Enforce monthly_scan_limit:
        // - count exact scan_events for this user within current month
        // - if limit reached, skip inserting the scan event (redirect still happens)
        const fallbackMonthlyScanLimit =
          plan === "STARTER" ? 10000 : plan === "PRO" ? 100000 : 1000;

        const { data: usageLimits } = userId
          ? await supabaseAdmin
              .from("usage_limits")
              .select("monthly_scan_limit")
              .eq("user_id", userId)
              .maybeSingle()
          : { data: null };

        const monthlyScanLimit = usageLimits?.monthly_scan_limit ?? fallbackMonthlyScanLimit;

        let scansThisMonth = 0;
        if (userId) {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);

          const { data: userQrCodes } = await supabaseAdmin
            .from("qr_codes")
            .select("id")
            .eq("user_id", userId);

          const qrCodeIds = (userQrCodes ?? []).map((r) => r.id);

          if (qrCodeIds.length > 0) {
            const { count } = await supabaseAdmin
              .from("scan_events")
              .select("id", { count: "exact", head: true })
              .gte("created_at", monthStart.toISOString())
              .in("qr_code_id", qrCodeIds);

            scansThisMonth = typeof count === "number" ? count : 0;
          }
        }

        const scanLogged = !userId || scansThisMonth < monthlyScanLimit;

        if (scanLogged) {
          await supabaseAdmin.from("scan_events").insert({
            qr_code_id: id,
            user_agent: userAgent ?? null,
            referrer: referrer ?? null,
            ip_hash: ipHash,
            country_code: countryCode ?? null,
            device_type: deviceType ?? null,
            os_name: osName ?? null,
          });
        }

        void posthogCapture({
          event: "scan_redirected",
          distinctId: userId ?? undefined,
          properties: {
            user_id: userId,
            project_id: qrOwner?.project_id ?? null,
            qr_code_id: id,
            campaign: qrOwner?.campaign ?? null,
            plan,
            source: "redirect",
            scan_logged: scanLogged,
            scans_this_month: scansThisMonth,
            monthly_scan_limit: monthlyScanLimit,
          },
        });
      } catch {
        // Intentionally ignore scan logging failures.
      }
    })();
  }

  let destination: URL;
  try {
    destination = new URL(targetUrl);
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.redirect(destination, 302);
}

