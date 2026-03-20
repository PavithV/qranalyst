import Link from "next/link";

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
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto rounded-xl border bg-white p-4 text-red-700">
          <p className="font-medium">Fehler beim Laden der QR-Codes.</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-zinc-600">
            Eingeloggt als <span className="font-medium">{user?.email}</span>
          </p>
          <div className="pt-1">
            <Link
              className="text-sm underline text-zinc-600 hover:text-zinc-900"
              href="/dashboard/billing"
            >
              Billing / Upgrade
            </Link>
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold mb-3">QR-Code erstellen</h2>
          <CreateQrCodeForm />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Deine QR-Codes</h2>
          </div>

          {qrCodes && qrCodes.length > 0 ? (
            <div className="flex flex-col gap-3">
              {qrCodes.map((qr) => (
                <div
                  key={qr.id}
                  className="rounded-xl border bg-white p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {qr.label ? qr.label : "QR-Code"}
                      </p>
                      <p className="text-sm text-zinc-600 break-words">
                        Ziel:{" "}
                        <span className="font-mono text-xs">
                          {qr.target_url}
                        </span>
                      </p>
                      <p className="text-sm text-zinc-500">
                        Erstellt:{" "}
                        {qr.created_at
                          ? new Date(qr.created_at).toLocaleString("de-DE")
                          : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <Link
                      className="underline text-sm"
                      href={`/q/${qr.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      QR testen
                    </Link>
                    <Link
                      className="rounded-lg border px-3 py-1 text-sm hover:bg-zinc-50"
                      href={`/dashboard/qrcodes/${qr.id}`}
                    >
                      Analytics ansehen
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-white p-4 text-zinc-600">
              Noch keine QR-Codes. Erstelle deinen ersten Code oben.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

