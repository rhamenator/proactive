CREATE TYPE "AddressRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "impersonation_sessions" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "organization_id" UUID,
  "campaign_id" UUID,
  "reason_text" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),

  CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visit_corrections" (
  "id" UUID NOT NULL,
  "visit_log_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "organization_id" UUID,
  "campaign_id" UUID,
  "reason_text" TEXT NOT NULL,
  "old_values_json" JSONB NOT NULL,
  "new_values_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "visit_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "address_requests" (
  "id" UUID NOT NULL,
  "turf_id" UUID NOT NULL,
  "organization_id" UUID,
  "campaign_id" UUID,
  "requested_by_user_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "approved_address_id" UUID,
  "status" "AddressRequestStatus" NOT NULL DEFAULT 'pending',
  "address_line1" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "notes" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "review_reason" TEXT,

  CONSTRAINT "address_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "impersonation_sessions_actor_user_id_ended_at_idx" ON "impersonation_sessions"("actor_user_id", "ended_at");
CREATE INDEX "impersonation_sessions_target_user_id_ended_at_idx" ON "impersonation_sessions"("target_user_id", "ended_at");
CREATE INDEX "impersonation_sessions_organization_id_idx" ON "impersonation_sessions"("organization_id");
CREATE INDEX "impersonation_sessions_campaign_id_idx" ON "impersonation_sessions"("campaign_id");

CREATE INDEX "visit_corrections_visit_log_id_idx" ON "visit_corrections"("visit_log_id");
CREATE INDEX "visit_corrections_actor_user_id_idx" ON "visit_corrections"("actor_user_id");
CREATE INDEX "visit_corrections_organization_id_idx" ON "visit_corrections"("organization_id");
CREATE INDEX "visit_corrections_campaign_id_idx" ON "visit_corrections"("campaign_id");

CREATE INDEX "address_requests_turf_id_idx" ON "address_requests"("turf_id");
CREATE INDEX "address_requests_organization_id_idx" ON "address_requests"("organization_id");
CREATE INDEX "address_requests_campaign_id_idx" ON "address_requests"("campaign_id");
CREATE INDEX "address_requests_requested_by_user_id_idx" ON "address_requests"("requested_by_user_id");
CREATE INDEX "address_requests_reviewed_by_user_id_idx" ON "address_requests"("reviewed_by_user_id");
CREATE INDEX "address_requests_status_idx" ON "address_requests"("status");

ALTER TABLE "impersonation_sessions"
ADD CONSTRAINT "impersonation_sessions_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions"
ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions"
ADD CONSTRAINT "impersonation_sessions_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions"
ADD CONSTRAINT "impersonation_sessions_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_corrections"
ADD CONSTRAINT "visit_corrections_visit_log_id_fkey"
FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_corrections"
ADD CONSTRAINT "visit_corrections_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_corrections"
ADD CONSTRAINT "visit_corrections_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_corrections"
ADD CONSTRAINT "visit_corrections_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "address_requests"
ADD CONSTRAINT "address_requests_turf_id_fkey"
FOREIGN KEY ("turf_id") REFERENCES "turfs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "address_requests"
ADD CONSTRAINT "address_requests_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "address_requests"
ADD CONSTRAINT "address_requests_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "address_requests"
ADD CONSTRAINT "address_requests_requested_by_user_id_fkey"
FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "address_requests"
ADD CONSTRAINT "address_requests_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "address_requests"
ADD CONSTRAINT "address_requests_approved_address_id_fkey"
FOREIGN KEY ("approved_address_id") REFERENCES "addresses"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
