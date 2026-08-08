CREATE TYPE "RecoveryCaseType" AS ENUM ('help_desk_mfa_reset', 'help_desk_account_recovery', 'break_glass_account_recovery');
CREATE TYPE "RecoveryCaseStatus" AS ENUM ('pending', 'executed', 'rejected', 'expired');
CREATE TYPE "RecoveryNotificationStatus" AS ENUM ('not_configured', 'pending', 'delivered', 'failed');

CREATE TABLE "recovery_cases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "type" "RecoveryCaseType" NOT NULL,
    "status" "RecoveryCaseStatus" NOT NULL DEFAULT 'pending',
    "reason_text" TEXT NOT NULL,
    "review_reason" TEXT,
    "notification_status" "RecoveryNotificationStatus" NOT NULL DEFAULT 'not_configured',
    "notification_error" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    CONSTRAINT "recovery_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recovery_cases_organization_id_status_created_at_idx" ON "recovery_cases"("organization_id", "status", "created_at");
CREATE INDEX "recovery_cases_target_user_id_status_idx" ON "recovery_cases"("target_user_id", "status");
CREATE INDEX "recovery_cases_requested_by_user_id_idx" ON "recovery_cases"("requested_by_user_id");
CREATE INDEX "recovery_cases_reviewed_by_user_id_idx" ON "recovery_cases"("reviewed_by_user_id");

ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
