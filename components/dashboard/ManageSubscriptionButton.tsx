"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";

type Plan = "FREE" | "STARTER" | "PRO";

export default function ManageSubscriptionButton({
  currentPlan,
  hasStripeCustomer,
}: {
  currentPlan: Plan;
  hasStripeCustomer: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentPlan === "FREE" || !hasStripeCustomer) {
    return (
      <p className="text-sm text-muted-foreground">
        Abo verwalten ist verfügbar, sobald du ein bezahltes Abo abgeschlossen hast (Stripe-Kundenkonto).
      </p>
    );
  }

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = typeof data.hint === "string" ? ` ${data.hint}` : "";
        setError(
          (typeof data.error === "string" ? data.error : "Portal fehlgeschlagen") + hint,
        );
        return;
      }
      const url = data?.url as string | undefined;
      if (url) window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="button" variant="outline" disabled={loading} onClick={() => void openPortal()}>
        {loading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ExternalLink className="mr-2 size-4" />
        )}
        Abo verwalten / kündigen (Stripe)
      </Button>
      <p className="text-xs text-muted-foreground">
        Öffnet das Stripe-Kundenportal: Kündigung zum Periodenende, Zahlungsmittel, Rechnungen.
      </p>
    </div>
  );
}
