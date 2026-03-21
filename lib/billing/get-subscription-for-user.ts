import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SubscriptionDisplay = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: Date | null;
};

/**
 * Liest Abo: zuerst Prisma (Postgres), bei leerem Ergebnis Fallback Service Role (wie im Dashboard),
 * falls DATABASE_URL ≠ Supabase-Projekt oder Prisma nicht greift.
 */
export async function getSubscriptionForUser(
  userId: string,
): Promise<SubscriptionDisplay | null> {
  try {
    const sub = await getPrisma().subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        stripeCustomerId: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
      },
    });
    if (sub) return sub;
  } catch {
    // Prisma / DATABASE_URL
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("subscriptions")
      .select(
        "plan,status,stripe_customer_id,cancel_at_period_end,current_period_end",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data || typeof data.plan !== "string") {
      return null;
    }

    const periodEndRaw = data.current_period_end as string | null | undefined;

    return {
      plan: data.plan as SubscriptionPlan,
      status: data.status as SubscriptionStatus,
      stripeCustomerId: (data.stripe_customer_id as string | null) ?? null,
      cancelAtPeriodEnd:
        typeof data.cancel_at_period_end === "boolean"
          ? data.cancel_at_period_end
          : null,
      currentPeriodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
    };
  } catch {
    return null;
  }
}
