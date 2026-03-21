import { Suspense } from "react";

import { getSubscriptionForUser } from "@/lib/billing/get-subscription-for-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reconcileCheckoutSessionFromStripe } from "@/lib/stripe/reconcile-checkout-session";
import BillingRefreshOnSuccess from "@/components/dashboard/BillingRefreshOnSuccess";
import BillingSyncCheckout from "@/components/dashboard/BillingSyncCheckout";
import UpgradePlanButtons from "@/components/dashboard/UpgradePlanButtons";
import BillingOutcomeEvents from "@/components/dashboard/BillingOutcomeEvents";
import ManageSubscriptionButton from "@/components/dashboard/ManageSubscriptionButton";
import { BadgeCheck, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    plan?: string;
    session_id?: string;
  }>;
}) {
  const sp = await searchParams;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const outcome =
    sp?.success === "1"
      ? "success"
      : sp?.canceled === "1"
        ? "canceled"
        : null;

  const stripeSessionId =
    typeof sp.session_id === "string" && sp.session_id.length > 0 ? sp.session_id : null;

  /** Direkt nach Checkout: Abo von Stripe lesen und per Prisma speichern (unabhängig vom Webhook). */
  let reconcileError: string | null = null;
  if (user?.id && outcome === "success" && stripeSessionId) {
    const result = await reconcileCheckoutSessionFromStripe({
      sessionId: stripeSessionId,
      expectedUserId: user.id,
    });
    if (!result.ok) {
      reconcileError = result.error;
    }
  }

  const subscription = user?.id
    ? await getSubscriptionForUser(user.id)
    : null;

  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);

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
        <BillingSyncCheckout />
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

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Abo verwalten</h2>
          <ManageSubscriptionButton
            currentPlan={displayPlan}
            hasStripeCustomer={hasStripeCustomer}
          />
        </section>

        {outcome === "success" ? (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
              <BadgeCheck className="size-4" />
              Checkout abgeschlossen. Abo wird mit Stripe abgeglichen (Supabase + Anzeige).
            </p>
            {reconcileError ? (
              <p className="text-sm text-destructive">
                Sync-Hinweis: {reconcileError} — prüfe{" "}
                <code className="rounded bg-muted px-1">STRIPE_SECRET_KEY</code> und Vercel-Logs.
              </p>
            ) : null}
            {!stripeSessionId && outcome === "success" ? (
              <p className="text-xs text-muted-foreground">
                Hinweis: Ohne <code className="rounded bg-muted px-1">session_id</code> in der URL
                (neuer Checkout nötig) kann der Plan nur per Webhook aktualisiert werden.
              </p>
            ) : null}
          </div>
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

