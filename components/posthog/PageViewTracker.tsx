"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { posthogCaptureClient } from "@/lib/posthog/capture-client";

export default function PageViewTracker() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);
  const accountRef = useRef<{ userId: string | null; plan: string | null } | null>(null);

  useEffect(() => {
    // Account einmalig laden, damit wir user_id/plan für page_view mitgeben können.
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        accountRef.current = {
          userId: data?.userId ?? null,
          plan: data?.plan ?? null,
        };
      })
      .catch(() => {
        accountRef.current = { userId: null, plan: null };
      });
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;

    const account = accountRef.current;

    void posthogCaptureClient({
      event: "page_view",
      distinctId: account?.userId ?? undefined,
      properties: {
        user_id: account?.userId ?? null,
        plan: account?.plan ?? null,
        source: "web",
        path: pathname,
      },
    });
  }, [pathname]);

  return null;
}

