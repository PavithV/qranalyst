import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowUpRight, BarChart3 } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getQrAnalytics } from "@/lib/analytics/get-qr-analytics";

export const dynamic = "force-dynamic";

const qrIdSchema = z.string().min(4).max(64);

export default async function QrCodeAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  const parsedId = qrIdSchema.safeParse(params.id);
  if (!parsedId.success) notFound();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: qr } = await supabase
    .from("qr_codes")
    .select("id,label,target_url,created_at")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (!qr || !user) notFound();

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

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            QR-Code:{" "}
            <span className="font-mono text-xs">{qr.id}</span>
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted" href="/dashboard">
              <ArrowLeft className="size-4" />
              Zurück
            </Link>
            <Link
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
              href={`/q/${qr.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Public Redirect öffnen
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Scans (Retention)
              </p>
              <p className="text-3xl font-semibold">{analytics.totalScans}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Unique Scanner (approx.)
              </p>
              <p className="text-3xl font-semibold">
                {analytics.uniqueScannersApprox}
              </p>
            </div>
          </div>

          {analytics.truncated ? (
            <p className="text-sm text-muted-foreground">
              Hinweis: Es wurden nur die neuesten Events geladen.
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="size-4 text-muted-foreground" />
              Scans nach Tag
            </h2>
            {analytics.scansByDay.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {analytics.scansByDay.slice(-7).map((d) => (
                  <div
                    key={d.day}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{d.day}</span>
                    <span className="font-medium">{d.scans}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Noch keine Scans.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-lg font-semibold">Scans nach Land</h2>
              {analytics.scansByCountry.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  {analytics.scansByCountry.slice(0, 8).map((c) => (
                    <div
                      key={c.countryCode}
                      className="flex items-center justify-between text-sm"
                    >
                    <span className="text-muted-foreground">{c.countryCode}</span>
                      <span className="font-medium">{c.scans}</span>
                    </div>
                  ))}
                </div>
              ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                  Noch keine Geo-Daten.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold">Scans nach Gerät</h2>
              {analytics.scansByDevice.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  {analytics.scansByDevice.slice(0, 6).map((d) => (
                    <div
                      key={d.deviceType}
                      className="flex items-center justify-between text-sm"
                    >
                    <span className="text-muted-foreground">{d.deviceType}</span>
                      <span className="font-medium">{d.scans}</span>
                    </div>
                  ))}
                </div>
              ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                  Noch keine Device-Daten.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

