"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Ruft POST /api/billing/sync-checkout mit session_id auf — zuverlässiger als nur SSR,
 * weil die URL-Query im Browser garantiert vollständig ist.
 */
export default function BillingSyncCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    if (searchParams.get("success") !== "1") return;

    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    ran.current = true;

    void (async () => {
      const res = await fetch("/api/billing/sync-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Sync fehlgeschlagen");
        return;
      }
      router.refresh();
    })();
  }, [router, searchParams]);

  if (!error) return null;

  return (
    <p className="text-sm text-destructive">
      Client-Sync: {error} — prüfe{" "}
      <code className="rounded bg-muted px-1">STRIPE_SECRET_KEY</code>,{" "}
      <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code> und Test/Live-Modus.
    </p>
  );
}
