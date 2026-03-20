"use client";

import { useEffect, useState } from "react";
import { posthogCaptureClient } from "@/lib/posthog/capture-client";

type Plan = "FREE" | "STARTER" | "PRO";

export default function UpgradePlanButtons({ currentPlan }: { currentPlan: Plan }) {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => setUserId(data?.userId ?? null))
      .catch(() => setUserId(null));
  }, []);

  async function startCheckout(plan: "STARTER" | "PRO") {
    setError(null);
    setLoadingPlan(plan);
    try {
      void posthogCaptureClient({
        event: "billing_started",
        distinctId: userId ?? undefined,
        properties: {
          user_id: userId,
          project_id: null,
          qr_code_id: null,
          campaign: null,
          plan,
          source: "dashboard",
        },
      });

      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Fehler beim Starten von Stripe Checkout.");
        return;
      }

      const url = body?.url as string | undefined;
      if (!url) {
        setError("Stripe Checkout URL fehlt.");
        return;
      }

      window.location.href = url;
    } catch {
      setError("Netzwerkfehler beim Starten von Stripe Checkout.");
    } finally {
      setLoadingPlan(null);
    }
  }

  const starterDisabled = currentPlan === "STARTER" || currentPlan === "PRO";
  const proDisabled = currentPlan === "PRO";

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={starterDisabled || loadingPlan === "STARTER"}
          onClick={() => startCheckout("STARTER")}
          className="rounded-lg border px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingPlan === "STARTER" ? "Weiter..." : "Starter upgraden"}
        </button>

        <button
          type="button"
          disabled={proDisabled || loadingPlan === "PRO"}
          onClick={() => startCheckout("PRO")}
          className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingPlan === "PRO" ? "Weiter..." : "Pro upgraden"}
        </button>
      </div>
    </div>
  );
}

