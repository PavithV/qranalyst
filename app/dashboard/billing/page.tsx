import { Suspense } from "react";

import { getSubscriptionForUser } from "@/lib/billing/get-subscription-for-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BillingRefreshOnSuccess from "@/components/dashboard/BillingRefreshOnSuccess";
import UpgradePlanButtons from "@/components/dashboard/UpgradePlanButtons";
import BillingOutcomeEvents from "@/components/dashboard/BillingOutcomeEvents";
import { BadgeCheck, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; plan?: string }>;
}) {
  const sp = await searchParams;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const subscription = user?.id
    ? await getSubscriptionForUser(user.id)
    : null;

  const outcome =
    sp?.success === "1"
      ? "success"
      : sp?.canceled === "1"
        ? "canceled"
        : null;

  const planFromQuery = (sp?.plan ?? "").toUpperCase();
  const planFromDb = subscription?.plan ?? null;
  /** DB hat Vorrang; nach Checkout kann die URL den Plan zeigen, solange die DB noch leer ist. */
  const displayPlan = (planFromDb ??
    (planFromQuery === "STARTER" || planFromQuery === "PRO"
      ? planFromQuery
      : "FREE")) as "FREE" | "STARTER" | "PRO";
  const planForEvents = displayPlan;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={null}>
        <BillingRefreshOnSuccess />
      </Suspense>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground">
            Aktueller Status:{" "}
              <span className="font-medium text-foreground">{subscription?.status ?? "-"}</span>{" "}
              · Plan: <span className="font-medium text-foreground">{subscription?.plan ?? "-"}</span>
            </p>
          </div>
          <CreditCard className="mt-1 size-5 text-muted-foreground" />
        </div>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Plan upgraden</h2>
          <UpgradePlanButtons currentPlan={displayPlan} />
        </section>

        {outcome === "success" ? (
          <p className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
            <BadgeCheck className="size-4" />
            Checkout abgeschlossen. Webhook aktualisiert das Abo.
          </p>
        ) : null}
        {outcome === "canceled" ? (
          <p className="text-sm text-muted-foreground">
            Checkout abgebrochen.
          </p>
        ) : null}
      </div>
      <BillingOutcomeEvents outcome={outcome} plan={planForEvents} />
    </div>
  );
}

