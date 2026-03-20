"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import QrCodePreviewButton from "@/components/dashboard/QrCodePreviewButton";

export default function QrCodeActions({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const confirmed = window.confirm("Diesen QR-Code wirklich löschen?");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/qrcodes/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler beim Löschen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
          href={`/q/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          QR testen
        </Link>
        <Link
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:opacity-90"
          href={`/dashboard/qrcodes/${id}`}
        >
          Analytics
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex h-9 items-center rounded-md border border-destructive/30 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {deleting ? "Lösche..." : "Löschen"}
        </button>
      </div>

      <QrCodePreviewButton id={id} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

