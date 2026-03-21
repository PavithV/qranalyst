-- Stripe: cancel_at_period_end — Abo bleibt oft "active" bis Periodenende
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN;
