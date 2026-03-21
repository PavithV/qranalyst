import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { posthogCapture } from "@/lib/posthog/capture";
import {
  planToUsageLimits,
  resolvePaidPlanFromStripeSubscription,
  syncPaidSubscriptionToSupabase,
} from "@/lib/stripe/subscription-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const starterPriceId = process.env.STRIPE_PRICE_ID_STARTER;

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json({ error: "Fehlende Stripe Webhook Config." }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = (subscription.metadata?.user_id ?? "") as string;

      const plan = resolvePaidPlanFromStripeSubscription(subscription, starterPriceId);

      if (!userId) {
        console.error(
          "[stripe webhook] customer.subscription.* ohne metadata.user_id — Abo nicht synchronisiert.",
        );
        break;
      }

      const status = (() => {
        if (event.type === "customer.subscription.deleted") return "canceled";
        return (subscription.status as string) ?? "active";
      })();

      const currentPeriodEndRaw = (subscription as unknown as {
        current_period_end?: number;
      }).current_period_end;
      const currentPeriodEnd =
        typeof currentPeriodEndRaw === "number"
          ? new Date(currentPeriodEndRaw * 1000)
          : null;

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.toString() ?? "";

      const cancelAtPeriodEnd =
        event.type === "customer.subscription.deleted"
          ? false
          : (subscription.cancel_at_period_end ?? false);

      const { error } = await syncPaidSubscriptionToSupabase(supabaseAdmin, {
        userId,
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });

      if (error) {
        console.error("[stripe webhook] syncPaidSubscriptionToSupabase:", error);
        break;
      }

      void posthogCapture({
        event:
          event.type === "customer.subscription.deleted"
            ? "subscription_canceled"
            : "subscription_upgraded",
        distinctId: userId,
        properties: {
          user_id: userId,
          project_id: null,
          qr_code_id: null,
          campaign: null,
          plan,
          source: "stripe",
        },
      });

      break;
    }

    /**
     * Wichtig: kommt oft direkt nach Zahlung und enthält Session-Metadata.
     * So ist die DB aktuell, auch wenn `customer.subscription.*` verzögert fehlt oder ohne Metadata kommt.
     */
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== "subscription") {
        break;
      }

      const userId = (session.metadata?.user_id ?? "") as string;
      const planFromMeta = session.metadata?.plan as "STARTER" | "PRO" | undefined;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;

      if (!userId || !subscriptionId) {
        console.error(
          "[stripe webhook] checkout.session.completed ohne user_id oder subscription id.",
          { userId: Boolean(userId), subscriptionId },
        );
        break;
      }

      let subscription: Stripe.Subscription;
      try {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } catch (e) {
        console.error("[stripe webhook] subscriptions.retrieve failed:", e);
        break;
      }

      const plan =
        planFromMeta === "STARTER" || planFromMeta === "PRO"
          ? planFromMeta
          : resolvePaidPlanFromStripeSubscription(subscription, starterPriceId);

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id ??
            (typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.toString() ?? "");

      const currentPeriodEndRaw = (subscription as unknown as {
        current_period_end?: number;
      }).current_period_end;
      const currentPeriodEnd =
        typeof currentPeriodEndRaw === "number"
          ? new Date(currentPeriodEndRaw * 1000)
          : null;

      const status = (subscription.status as string) ?? "active";

      const { error } = await syncPaidSubscriptionToSupabase(supabaseAdmin, {
        userId,
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      });

      if (error) {
        console.error("[stripe webhook] checkout.session.completed sync:", error);
      }

      void posthogCapture({
        event: "stripe_checkout_completed",
        distinctId: userId,
        properties: {
          user_id: userId,
          project_id: null,
          qr_code_id: null,
          campaign: null,
          plan,
          source: "stripe",
        },
      });

      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
