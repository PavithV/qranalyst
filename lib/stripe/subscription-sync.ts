import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export function mapPriceIdToPlan(
  priceId: string,
  starterPriceId: string | undefined,
): "STARTER" | "PRO" {
  if (starterPriceId && priceId === starterPriceId) return "STARTER";
  return "PRO";
}

export function planToUsageLimits(plan: "FREE" | "STARTER" | "PRO") {
  switch (plan) {
    case "STARTER":
      return {
        qr_code_limit: 50,
        monthly_scan_limit: 10000,
        analytics_retention_days: 180,
      };
    case "PRO":
      return {
        qr_code_limit: 200,
        monthly_scan_limit: 100000,
        analytics_retention_days: 365,
      };
    case "FREE":
    default:
      return {
        qr_code_limit: 10,
        monthly_scan_limit: 1000,
        analytics_retention_days: 90,
      };
  }
}

type PaidPlan = "STARTER" | "PRO";

/** Postgres-Enum `SubscriptionStatus` — nicht alle Stripe-Strings sind gültig. */
export function mapStripeSubscriptionStatusToDb(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "canceled":
    case "incomplete":
    case "trialing":
    case "past_due":
      return stripeStatus;
    case "unpaid":
    case "paused":
      return "past_due";
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

/**
 * Schreibt Abo + Limits in Supabase (Service Role). Wird von Webhook-Events genutzt.
 */
export async function syncPaidSubscriptionToSupabase(
  supabaseAdmin: SupabaseClient,
  params: {
    userId: string;
    plan: PaidPlan;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodEnd: Date | null;
  },
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const usage = planToUsageLimits(params.plan);
  const status = mapStripeSubscriptionStatusToDb(params.status);

  const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      plan: params.plan,
      status,
      current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (subErr) {
    return { error: subErr.message };
  }

  const { error: limErr } = await supabaseAdmin.from("usage_limits").upsert(
    {
      user_id: params.userId,
      ...usage,
    },
    { onConflict: "user_id" },
  );

  if (limErr) {
    return { error: limErr.message };
  }

  return { error: null };
}

export function resolvePaidPlanFromStripeSubscription(
  subscription: Stripe.Subscription,
  starterPriceId: string | undefined,
): PaidPlan {
  const fromMeta = subscription.metadata?.plan as PaidPlan | undefined;
  if (fromMeta === "STARTER" || fromMeta === "PRO") return fromMeta;
  const priceId = subscription.items.data[0]?.price.id ?? "";
  return priceId ? mapPriceIdToPlan(priceId, starterPriceId) : "STARTER";
}
