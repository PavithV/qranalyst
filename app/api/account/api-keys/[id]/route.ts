import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const result = await prisma.apiKey.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
