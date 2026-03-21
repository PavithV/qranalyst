import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe Customer Portal — Abo kündigen, Zahlungsmittel, Rechnungen.
 * Im Stripe Dashboard: Settings → Billing → Customer portal (aktivieren).
 */
export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_URL;

  if (!stripeSecretKey || !appUrl) {
    return NextResponse.json(
      { error: "Fehlende Stripe/App-Konfiguration." },
      { status: 500 },
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customerId = row?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "Kein Stripe-Kundenkonto vorhanden. Ein Kundenkonto entsteht mit dem ersten bezahlten Abo.",
      },
      { status: 400 },
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const base = appUrl.replace(/\/$/, "");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/dashboard/billing`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Portal-URL fehlt." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Stripe Customer Portal konnte nicht geöffnet werden.";
    return NextResponse.json(
      {
        error: msg,
        hint:
          "Im Stripe Dashboard unter Settings → Billing → Customer portal das Portal aktivieren.",
      },
      { status: 422 },
    );
  }
}
