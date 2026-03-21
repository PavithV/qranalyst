import { getPrisma } from "@/lib/prisma";

/** Liest Abo direkt aus Postgres (Prisma) — umgeht RLS-Probleme beim Anon-Client. */
export async function getSubscriptionForUser(userId: string) {
  try {
    return await getPrisma().subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });
  } catch {
    return null;
  }
}
