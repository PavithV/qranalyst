import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// PrismaClient als Singleton, damit bei Next.js Dev-Hot-Reload nicht
// jedes Mal neue DB-Verbindungen entstehen.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let prismaInstance: PrismaClient | undefined = globalForPrisma.prisma;

export function getPrisma() {
  if (prismaInstance) return prismaInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL fehlt. Für Prisma-Migrationen/DB-Zugriff benötigst du eine gültige Supabase Postgres Connection String.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  prismaInstance = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

  globalForPrisma.prisma = prismaInstance;
  return prismaInstance;
}

