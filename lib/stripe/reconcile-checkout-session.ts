import { randomUUID } from "node:crypto";

import Stripe from "stripe";
import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import {
  mapStripeSubscriptionStatusToDb,
  planToUsageLimits,
  resolvePaidPlanFromStripeSubscription,
} from "@/lib/stripe/subscription-sync";

/**
 * Liest die Checkout-Session direkt bei Stripe und schreibt Abo + Limits per Prisma.
 * Unabhängig vom Webhook — löst Fälle, in denen Webhooks fehlen, verzögert sind oder
 * Supabase-Upserts still scheitern.
 */
export async function reconcileCheckoutSessionFromStripe(opts: {
  sessionId: string;
  expectedUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { ok: false, error: "STRIPE_SECRET_KEY fehlt." };
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
  const plan = resolvePaidPlanFromStripeSubscription(stripeSub, starterPriceId) as SubscriptionPlan;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && typeof session.customer === "object" && "id" in session.customer
        ? (session.customer as Stripe.Customer).id
        : typeof stripeSub.customer === "string"
          ? stripeSub.customer
          : stripeSub.customer?.toString() ?? "";

  const statusRaw = mapStripeSubscriptionStatusToDb(stripeSub.status);
  const status = statusRaw as SubscriptionStatus;

  const periodEndTs = (stripeSub as unknown as { current_period_end?: number })
    .current_period_end;
  const periodEnd =
    typeof periodEndTs === "number" ? new Date(periodEndTs * 1000) : null;

  const usage = planToUsageLimits(plan);

  const prisma = getPrisma();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { userId: opts.expectedUserId },
        create: {
          id: randomUUID(),
          userId: opts.expectedUserId,
          plan,
          status,
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: stripeSub.id,
          currentPeriodEnd: periodEnd,
        },
        update: {
          plan,
          status,
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: stripeSub.id,
          currentPeriodEnd: periodEnd,
        },
      });

      await tx.usageLimit.upsert({
        where: { userId: opts.expectedUserId },
        create: {
          userId: opts.expectedUserId,
          qrCodeLimit: usage.qr_code_limit,
          monthlyScanLimit: usage.monthly_scan_limit,
          analyticsRetentionDays: usage.analytics_retention_days,
        },
        update: {
          qrCodeLimit: usage.qr_code_limit,
          monthlyScanLimit: usage.monthly_scan_limit,
          analyticsRetentionDays: usage.analytics_retention_days,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Prisma sync failed";
    return { ok: false, error: msg };
  }

  return { ok: true };
}
