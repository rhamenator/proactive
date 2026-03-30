CREATE TABLE "system_configuration" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "auth_rate_limit_window_minutes" INTEGER NOT NULL DEFAULT 15,
  "auth_rate_limit_max_attempts" INTEGER NOT NULL DEFAULT 10,
  "retention_job_enabled" BOOLEAN NOT NULL DEFAULT false,
  "retention_job_interval_minutes" INTEGER NOT NULL DEFAULT 60,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "system_configuration_pkey" PRIMARY KEY ("id")
);
