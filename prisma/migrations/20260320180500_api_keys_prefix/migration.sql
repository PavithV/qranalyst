-- Prefix for UI (secret itself is stored only as hash in `key`)
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_prefix" TEXT NOT NULL DEFAULT '';
