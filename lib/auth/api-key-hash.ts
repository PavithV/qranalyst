import { createHash } from "node:crypto";

/** SHA-256 hex — Klartext-Key niemals in der DB speichern. */
export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
