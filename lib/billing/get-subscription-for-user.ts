import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SubRow = { plan: SubscriptionPlan; status: SubscriptionStatus };

/**
 * Liest Abo: zuerst Prisma (Postgres), bei leerem Ergebnis Fallback Service Role (wie im Dashboard),
 * falls DATABASE_URL ≠ Supabase-Projekt oder Prisma nicht greift.
 */
export async function getSubscriptionForUser(
  userId: string,
): Promise<SubRow | null> {
  try {
    const sub = await getPrisma().subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });
    if (sub) return sub;
  } catch {
    // Prisma / DATABASE_URL
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data || typeof data.plan !== "string") {
      return null;
    }

    return {
      plan: data.plan as SubscriptionPlan,
      status: data.status as SubscriptionStatus,
    };
  } catch {
    return null;
  }
}
