import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { posthogCapture } from "@/lib/posthog/capture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mapPriceIdToPlan(priceId: string): "STARTER" | "PRO" {
  const starterPrice = process.env.STRIPE_PRICE_ID_STARTER;

  if (starterPrice && priceId === starterPrice) return "STARTER";
  return "PRO";
}

function planToUsageLimits(plan: "FREE" | "STARTER" | "PRO") {
  switch (plan) {
    case "STARTER":
      return { qr_code_limit: 50, monthly_scan_limit: 10000, analytics_retention_days: 180 };
    case "PRO":
      return { qr_code_limit: 200, monthly_scan_limit: 100000, analytics_retention_days: 365 };
    case "FREE":
    default:
      return { qr_code_limit: 10, monthly_scan_limit: 1000, analytics_retention_days: 90 };
  }
}

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

  // We handle a minimal subset of events for MVP.
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = (subscription.metadata?.user_id ?? "") as string;
      const planFromMeta = subscription.metadata?.plan as "STARTER" | "PRO" | undefined;

      // Der Plan kommt im Normalfall aus Metadata oder aus der Price-ID der Items.
      const priceId = subscription.items.data[0]?.price.id ?? "";
      const plan = (planFromMeta ?? (priceId ? mapPriceIdToPlan(priceId) : "STARTER")) as
        | "STARTER"
        | "PRO";

      if (!userId) break;

      const status = (() => {
        if (event.type === "customer.subscription.deleted") return "canceled";
        // subscription.status: active/trialing/incomplete/past_due/canceled
        return (subscription.status as string) ?? "active";
      })();

      const currentPeriodEndRaw = (subscription as unknown as {
        current_period_end?: number;
      }).current_period_end;
      const currentPeriodEnd =
        typeof currentPeriodEndRaw === "number"
          ? new Date(currentPeriodEndRaw * 1000).toISOString()
          : null;

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id:
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.toString(),
          stripe_subscription_id: subscription.id,
          plan,
          status,
          current_period_end: currentPeriodEnd,
        },
        { onConflict: "user_id" },
      );

      // Limits aktualisieren
      const usage = planToUsageLimits(plan);
      await supabaseAdmin.from("usage_limits").upsert(
        {
          user_id: userId,
          ...usage,
        },
        { onConflict: "user_id" },
      );

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

    // Für MVP reicht es; je nach Stripe-Flow können auch andere Events relevant sein.
    case "checkout.session.completed":
      void (async () => {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.user_id ?? "") as string;
        const plan = (session.metadata?.plan ?? "STARTER") as "STARTER" | "PRO";
        if (!userId) return;

        await posthogCapture({
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
      })();
      break;

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

