import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // IMPORTANT:
    // Prisma `env()` wirft bereits beim fehlenden Key, daher nicht für Fallbacks nutzen.
    // Wir wollen stattdessen DIRECT_URL bevorzugen, aber auf DATABASE_URL zurückfallen können.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});

