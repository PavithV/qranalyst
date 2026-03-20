import { getPrisma } from "@/lib/prisma";
import { hashApiKeySecret } from "@/lib/auth/api-key-hash";

export function extractBearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization");
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  const token = m?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export type ApiKeyAuthResult = { userId: string; apiKeyId: string };

export async function authenticateApiKey(
  req: Request,
): Promise<ApiKeyAuthResult | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const prisma = getPrisma();
  const hash = hashApiKeySecret(token);
  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { id: true, userId: true },
  });
  if (!row) return null;
  return { userId: row.userId, apiKeyId: row.id };
}

/** Fire-and-forget: letzte Nutzung ohne Request-Latenz-Spikes. */
export function touchApiKeyLastUsed(apiKeyId: string): void {
  void getPrisma()
    .apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Ignorieren: Analytics-Feld, kein kritischer Pfad
    });
}
