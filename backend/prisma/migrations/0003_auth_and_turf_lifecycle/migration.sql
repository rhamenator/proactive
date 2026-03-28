-- CreateEnum
CREATE TYPE "TurfStatus" AS ENUM ('unassigned', 'assigned', 'in_progress', 'paused', 'completed', 'reopened', 'archived');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'paused', 'ended', 'force_closed');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "invited_at" TIMESTAMP(3),
  ADD COLUMN "activated_at" TIMESTAMP(3),
  ADD COLUMN "last_login_at" TIMESTAMP(3);

UPDATE "users"
SET "activated_at" = "created_at"
WHERE "is_active" = true AND "activated_at" IS NULL;

UPDATE "users"
SET "status" = 'inactive'
WHERE "is_active" = false AND "status" = 'active';

-- AlterTable
ALTER TABLE "turfs"
  ADD COLUMN "status" "TurfStatus" NOT NULL DEFAULT 'unassigned',
  ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "completed_by" UUID,
  ADD COLUMN "reopened_at" TIMESTAMP(3),
  ADD COLUMN "reopened_by" UUID,
  ADD COLUMN "reopened_reason" TEXT;

UPDATE "turfs"
SET "status" = 'assigned'
WHERE EXISTS (
  SELECT 1
  FROM "turf_assignments"
  WHERE "turf_assignments"."turf_id" = "turfs"."id"
);

-- AlterTable
ALTER TABLE "turf_assignments"
  ADD COLUMN "assigned_by_user_id" UUID,
  ADD COLUMN "unassigned_at" TIMESTAMP(3),
  ADD COLUMN "reassignment_reason" TEXT;

-- AlterTable
ALTER TABLE "turf_sessions"
  ADD COLUMN "last_activity_at" TIMESTAMP(3),
  ADD COLUMN "pause_reason" TEXT,
  ADD COLUMN "end_reason" TEXT;

ALTER TABLE "turf_sessions"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "turf_sessions"
  ALTER COLUMN "status" TYPE "SessionStatus"
  USING (
    CASE
      WHEN "status" = 'paused' THEN 'paused'
      WHEN "status" = 'ended' THEN 'ended'
      WHEN "status" = 'force_closed' THEN 'force_closed'
      ELSE 'active'
    END
  )::"SessionStatus";

ALTER TABLE "turf_sessions"
  ALTER COLUMN "status" SET DEFAULT 'active';

UPDATE "turf_sessions"
SET "last_activity_at" = COALESCE("end_time", "start_time")
WHERE "last_activity_at" IS NULL;

UPDATE "turfs"
SET "status" = 'paused'
WHERE EXISTS (
  SELECT 1
  FROM "turf_sessions"
  WHERE "turf_sessions"."turf_id" = "turfs"."id"
    AND "turf_sessions"."end_time" IS NULL
    AND "turf_sessions"."status" = 'paused'
);

UPDATE "turfs"
SET "status" = 'in_progress'
WHERE EXISTS (
  SELECT 1
  FROM "turf_sessions"
  WHERE "turf_sessions"."turf_id" = "turfs"."id"
    AND "turf_sessions"."end_time" IS NULL
    AND "turf_sessions"."status" = 'active'
);

UPDATE "turfs"
SET "status" = 'completed',
    "completed_at" = CURRENT_TIMESTAMP
WHERE "status" NOT IN ('paused', 'in_progress')
  AND EXISTS (
    SELECT 1
    FROM "turf_assignments"
    WHERE "turf_assignments"."turf_id" = "turfs"."id"
      AND "turf_assignments"."status" = 'completed'
  );

-- CreateTable
CREATE TABLE "auth_refresh_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" TEXT,
  "user_agent" TEXT,

  CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turfs_status_idx" ON "turfs"("status");

-- CreateIndex
CREATE INDEX "turf_assignments_assigned_by_user_id_idx" ON "turf_assignments"("assigned_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key" ON "auth_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_tokens_user_id_idx" ON "auth_refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "activation_tokens_token_hash_key" ON "activation_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "activation_tokens_user_id_idx" ON "activation_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "auth_refresh_tokens"
  ADD CONSTRAINT "auth_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activation_tokens"
  ADD CONSTRAINT "activation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
