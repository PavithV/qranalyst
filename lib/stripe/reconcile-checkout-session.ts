import Stripe from "stripe";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  resolvePaidPlanFromStripeSubscription,
  syncPaidSubscriptionToSupabase,
} from "@/lib/stripe/subscription-sync";

/**
 * Liest die Checkout-Session bei Stripe und schreibt Abo + Limits per **Supabase Service Role**
 * (gleicher Pfad wie der Webhook) — damit die Daten im Supabase-Dashboard sichtbar sind.
 * Unabhängig vom Webhook.
 */
export async function reconcileCheckoutSessionFromStripe(opts: {
  sessionId: string;
  expectedUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { ok: false, error: "STRIPE_SECRET_KEY fehlt." };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase Admin fehlt";
    return { ok: false, error: msg };
  }

  const stripe = new Stripe(stripeSecretKey);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(opts.sessionId, {
      expand: ["subscription", "customer"],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe retrieve failed";
    return { ok: false, error: msg };
  }

  const metaUser = session.metadata?.user_id;
  if (metaUser && metaUser !== opts.expectedUserId) {
    return { ok: false, error: "Session gehört zu einem anderen Benutzer." };
  }

  if (session.mode !== "subscription") {
    return { ok: false, error: "Kein Subscription-Checkout." };
  }

  const subscriptionRef = session.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef && typeof subscriptionRef === "object" && "id" in subscriptionRef
        ? (subscriptionRef as Stripe.Subscription).id
        : null;

  if (!subscriptionId) {
    return { ok: false, error: "Keine Subscription-ID in der Session." };
  }

  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "subscriptions.retrieve failed";
    return { ok: false, error: msg };
  }

  const starterPriceId = process.env.STRIPE_PRICE_ID_STARTER;
  const plan = resolvePaidPlanFromStripeSubscription(stripeSub, starterPriceId);

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && typeof session.customer === "object" && "id" in session.customer
        ? (session.customer as Stripe.Customer).id
        : typeof stripeSub.customer === "string"
          ? stripeSub.customer
          : stripeSub.customer?.toString() ?? "";

  const periodEndTs = (stripeSub as unknown as { current_period_end?: number })
    .current_period_end;
  const periodEnd =
    typeof periodEndTs === "number" ? new Date(periodEndTs * 1000) : null;

  const { error } = await syncPaidSubscriptionToSupabase(supabaseAdmin, {
    userId: opts.expectedUserId,
    plan,
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub.id,
    status: stripeSub.status,
    currentPeriodEnd: periodEnd,
  });

  if (error) {
    return { ok: false, error };
  }

  return { ok: true };
}
