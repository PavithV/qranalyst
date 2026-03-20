"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { posthogCaptureClient } from "@/lib/posthog/capture-client";

type ApiResponse = {
  id: string;
  shortUrl: string;
  shortPath: string;
  qrImageUrl: string;
};

export default function CreateQrCodeForm() {
  const router = useRouter();

  const [targetUrl, setTargetUrl] = useState("");
  const [label, setLabel] = useState("");
  const [campaign, setCampaign] = useState("");
  const [color, setColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [created, setCreated] = useState<ApiResponse | null>(null);
  const [account, setAccount] = useState<{ userId: string; plan: "FREE" | "STARTER" | "PRO" } | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.userId) return;
        setAccount({
          userId: data.userId,
          plan: (data.plan ?? "FREE") as "FREE" | "STARTER" | "PRO",
        });
      })
      .catch(() => {
        // ignore
      });
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const payload = {
      target_url: targetUrl.trim(),
      label: label.trim() || undefined,
      campaign: campaign.trim() || undefined,
      color: color.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
    };

    setLoading(true);
    try {
      void posthogCaptureClient({
        event: "qrcode_create_clicked",
        distinctId: account?.userId ?? undefined,
        properties: {
          user_id: account?.userId ?? null,
          project_id: null,
          qr_code_id: null,
          campaign: payload.campaign ?? null,
          plan: account?.plan ?? null,
          source: "dashboard",
        },
      });

      const res = await fetch("/api/qrcodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const baseError = body?.error ?? "Fehler beim Erstellen des QR-Codes.";
        const details = body?.details ? `: ${body.details}` : "";
        setError(`${baseError}${details}`);
        setLoading(false);
        return;
      }

      const createdBody = body as ApiResponse;
      setCreated(createdBody);

      void posthogCaptureClient({
        event: "qrcode_created",
        distinctId: account?.userId ?? undefined,
        properties: {
          user_id: account?.userId ?? null,
          project_id: null,
          qr_code_id: createdBody.id,
          campaign: payload.campaign ?? null,
          plan: account?.plan ?? null,
          source: "dashboard",
        },
      });
      router.refresh();
    } catch {
      setError("Netzwerkfehler beim Erstellen des QR-Codes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-700">Ziel-URL</label>
        <input
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className="border rounded-lg px-3 py-2"
          type="url"
          placeholder="https://beispiel.de/..."
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-700">Label (optional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border rounded-lg px-3 py-2"
            placeholder="z.B. Kampagne April"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-700">Campaign (optional)</label>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="border rounded-lg px-3 py-2"
            placeholder="z.B. spring-2026"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-700">Color (optional)</label>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border rounded-lg px-3 py-2"
            placeholder="#000000"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-700">Logo URL (optional)</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="border rounded-lg px-3 py-2"
            placeholder="https://beispiel.de/logo.png"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-black text-white py-2 px-3 disabled:opacity-50"
      >
        {loading ? "Erstelle..." : "QR-Code erstellen"}
      </button>

      {created ? (
        <div className="rounded-xl border bg-zinc-50 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium">Erstellt: {created.id}</p>
              <p className="text-sm text-zinc-600">
                Short URL:{" "}
                <span className="font-mono text-xs">
                  {created.shortUrl}
                </span>
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <Link
                className="rounded-lg border px-3 py-1 text-sm hover:bg-white"
                href={`/dashboard/qrcodes/${created.id}`}
              >
                Analytics
              </Link>
              <Link
                className="underline text-sm"
                href={created.shortPath}
                target="_blank"
                rel="noreferrer"
              >
                Test-Redirect
              </Link>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={created.qrImageUrl}
            alt="QR Code Vorschau"
            className="w-48 h-48"
          />
        </div>
      ) : null}
    </form>
  );
}

