import {
  type Subscription,
  type SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { getPrisma } from "@/lib/prisma";

/** Nur für Anfragen mit Bearer API-Key (nicht Browser-Session). */
export function apiMonthlyRequestLimitForPlan(plan: SubscriptionPlan): number {
  switch (plan) {
    case "FREE":
      return 10;
    case "STARTER":
      return 5_000;
    case "PRO":
      return 100_000;
    default:
      return 10;
  }
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Effektiver Plan für API-Kontingent: kein aktives Abo → FREE. */
export function effectivePlanForApiUsage(
  sub: Pick<Subscription, "plan" | "status"> | null,
): SubscriptionPlan {
  if (!sub) return "FREE";
  if (
    sub.status === SubscriptionStatus.canceled ||
    sub.status === SubscriptionStatus.incomplete
  ) {
    return "FREE";
  }
  return sub.plan;
}

/**
 * Atomar: Zähler erhöhen nur wenn unter Limit.
 * @returns ok false → HTTP 429 mit used/limit im Body sinnvoll
 */
export async function consumeApiMonthlyRequest(userId: string): Promise<
  | { ok: true; limit: number; used: number }
  | { ok: false; limit: number; used: number }
> {
  const prisma = getPrisma();
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  const plan = effectivePlanForApiUsage(sub);
  const limit = apiMonthlyRequestLimitForPlan(plan);
  const yearMonth = currentYearMonth();

  await prisma.apiMonthlyUsage.upsert({
    where: {
      userId_yearMonth: { userId, yearMonth },
    },
    create: { userId, yearMonth, count: 0 },
    update: {},
  });

  const updated = await prisma.apiMonthlyUsage.updateMany({
    where: {
      userId,
      yearMonth,
      count: { lt: limit },
    },
    data: { count: { increment: 1 } },
  });

  if (updated.count > 0) {
    const row = await prisma.apiMonthlyUsage.findUnique({
      where: { userId_yearMonth: { userId, yearMonth } },
      select: { count: true },
    });
    const used = row?.count ?? 0;
    return { ok: true, limit, used };
  }

  const row = await prisma.apiMonthlyUsage.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
    select: { count: true },
  });
  const used = row?.count ?? limit;
  return { ok: false, limit, used };
}
