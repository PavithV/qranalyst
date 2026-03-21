import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { hashApiKeySecret } from "@/lib/auth/api-key-hash";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1, "Name erforderlich.").max(120),
});

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({ apiKeys: keys });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben" },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const existingCount = await prisma.apiKey.count({
    where: { userId: user.id },
  });
  if (existingCount >= 1) {
    return NextResponse.json(
      {
        error:
          "Maximal ein API-Key pro Konto. Bitte lösche den bestehenden Key, bevor du einen neuen erstellst.",
      },
      { status: 400 },
    );
  }

  const secret = `sqa_${randomBytes(24).toString("base64url")}`;
  const keyHash = hashApiKeySecret(secret);
  const keyPrefix =
    secret.length > 14 ? `${secret.slice(0, 14)}…` : `${secret}…`;

  const row = await prisma.apiKey.create({
    data: {
      keyHash,
      keyPrefix,
      userId: user.id,
      name: parsed.data.name.trim(),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    apiKey: {
      ...row,
      /** Nur dieses eine Mal zurückgeben */
      secret,
    },
  });
}
