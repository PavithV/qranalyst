"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Nach Stripe-Redirect kann die Seite rendern, bevor der Webhook die DB aktualisiert hat.
 * Einmaliges Refresh nach kurzer Verzögerung, damit Plan/Status sichtbar werden.
 */
export default function BillingRefreshOnSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didRefresh = useRef(false);

  useEffect(() => {
    if (didRefresh.current) return;
    const success = searchParams.get("success");
    if (success !== "1") return;

    didRefresh.current = true;
    const t = window.setTimeout(() => {
      router.refresh();
    }, 2000);

    return () => window.clearTimeout(t);
  }, [router, searchParams]);

  return null;
}
