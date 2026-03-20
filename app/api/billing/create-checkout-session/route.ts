import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const checkoutSchema = z.object({
  plan: z.enum(["STARTER", "PRO"]),
});

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_URL;

  if (!stripeSecretKey || !appUrl) {
    return NextResponse.json(
      { error: "Fehlende Stripe/App-Konfiguration (Env Variablen)." },
      { status: 500 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Request-Daten." }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Preis-ID pro Plan
  const priceId =
    parsed.data.plan === "STARTER"
      ? process.env.STRIPE_PRICE_ID_STARTER
      : process.env.STRIPE_PRICE_ID_PRO;

  if (!priceId) {
    return NextResponse.json({ error: "Fehlende STRIPE_PRICE_ID_*." }, { status: 500 });
  }

  const baseApp = appUrl.replace(/\/$/, "");
  const successUrl = `${baseApp}/dashboard/billing?success=1&plan=${parsed.data.plan}`;
  const cancelUrl = `${baseApp}/dashboard/billing?canceled=1&plan=${parsed.data.plan}`;

  // Kunde ermitteln/erstellen
  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: user.id,
      plan: parsed.data.plan,
      source: "dashboard",
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan: parsed.data.plan,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe Checkout URL fehlt." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}

