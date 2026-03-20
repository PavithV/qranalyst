"use client";

import { useState } from "react";

type QrCodeDetailsResponse = {
  qrImageUrl: string;
  shortUrl: string;
};

export default function QrCodePreviewButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QrCodeDetailsResponse | null>(null);

  async function onToggle() {
    if (open) {
      setOpen(false);
      return;
    }

    setError(null);
    setOpen(true);
    if (data) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/qrcodes/${id}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "QR-Code konnte nicht geladen werden.");
        return;
      }

      setData({
        qrImageUrl: body?.qrImageUrl,
        shortUrl: body?.shortUrl,
      });
    } catch {
      setError("Netzwerkfehler beim Laden des QR-Codes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
      >
        {open ? "QR ausblenden" : "QR anzeigen"}
      </button>

      {open ? (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          {loading ? <p className="text-sm text-muted-foreground">Lade QR...</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {data?.qrImageUrl ? (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrImageUrl} alt="QR Code" className="h-40 w-40 rounded border border-border" />
              <p className="text-xs text-muted-foreground break-all">
                {data.shortUrl}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

