"use client";

import { useEffect, useState } from "react";

import { posthogCaptureClient } from "@/lib/posthog/capture-client";

type Plan = "FREE" | "STARTER" | "PRO";

export default function BillingOutcomeEvents({
  outcome,
  plan,
}: {
  outcome: "success" | "canceled" | null;
  plan: Plan;
}) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!outcome) return;

    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        setUserId(data?.userId ?? null);
      })
      .catch(() => {
        setUserId(null);
      });
  }, [outcome]);

  useEffect(() => {
    if (!outcome) return;
    if (outcome !== "success") return;

    void posthogCaptureClient({
      event: "billing_completed",
      distinctId: userId ?? undefined,
      properties: {
        user_id: userId,
        project_id: null,
        qr_code_id: null,
        campaign: null,
        plan,
        source: "stripe",
      },
    });
  }, [outcome, plan, userId]);

  return null;
}

