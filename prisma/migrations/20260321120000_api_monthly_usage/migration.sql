-- Zähler für API-Anfragen pro Kalendermonat (Bearer API-Key), pro User
CREATE TABLE "api_monthly_usage" (
    "user_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_monthly_usage_pkey" PRIMARY KEY ("user_id","year_month"),
    CONSTRAINT "api_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "api_monthly_usage_user_id_idx" ON "api_monthly_usage"("user_id");
