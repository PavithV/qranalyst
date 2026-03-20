import Link from "next/link";
import { BarChart3, ChartNoAxesCombined, Link2, QrCode } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateQrCodeForm from "@/components/dashboard/CreateQrCodeForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: qrCodes, error } = await supabase
    .from("qr_codes")
    .select("id,target_url,label,campaign,color,logo_url,is_active,created_at")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-destructive shadow-sm">
          <p className="font-medium">Fehler beim Laden der QR-Codes.</p>
          <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  const totalQrCodes = qrCodes?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Eingeloggt als <span className="font-medium text-foreground">{user?.email}</span>
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">QR Codes</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold">{totalQrCodes}</p>
            <QrCode className="size-4 text-muted-foreground" />
          </div>
        </article>
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Short Links aktiv</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold">{totalQrCodes}</p>
            <Link2 className="size-4 text-muted-foreground" />
          </div>
        </article>
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Analytics Setup</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold">Ready</p>
            <BarChart3 className="size-4 text-muted-foreground" />
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">QR-Code erstellen</h2>
          <ChartNoAxesCombined className="size-4 text-muted-foreground" />
        </div>
        <CreateQrCodeForm />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Deine QR-Codes</h2>
          <Link className="text-sm text-muted-foreground underline-offset-4 hover:underline" href="/dashboard/billing">
            Billing / Upgrade
          </Link>
        </div>

        {qrCodes && qrCodes.length > 0 ? (
          <div className="flex flex-col gap-3">
            {qrCodes.map((qr) => (
              <article
                key={qr.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{qr.label ? qr.label : "QR-Code"}</p>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      Ziel: <span className="font-mono text-xs">{qr.target_url}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Erstellt:{" "}
                      {qr.created_at ? new Date(qr.created_at).toLocaleString("de-DE") : "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                      href={`/q/${qr.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      QR testen
                    </Link>
                    <Link
                      className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:opacity-90"
                      href={`/dashboard/qrcodes/${qr.id}`}
                    >
                      Analytics
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Noch keine QR-Codes. Erstelle deinen ersten Code oben.
          </div>
        )}
      </section>
    </div>
  );
}

