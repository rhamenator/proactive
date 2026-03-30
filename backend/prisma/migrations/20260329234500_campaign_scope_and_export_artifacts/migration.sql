ALTER TABLE "users"
ADD COLUMN "campaign_id" UUID;

ALTER TABLE "users"
ADD CONSTRAINT "users_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_campaign_id_idx" ON "users"("campaign_id");

ALTER TABLE "export_batches"
ADD COLUMN "organization_id" UUID,
ADD COLUMN "campaign_id" UUID,
ADD COLUMN "csv_content" TEXT,
ADD COLUMN "sha256_checksum" TEXT;

ALTER TABLE "export_batches"
ADD CONSTRAINT "export_batches_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "export_batches"
ADD CONSTRAINT "export_batches_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "export_batches_organization_id_idx" ON "export_batches"("organization_id");
CREATE INDEX "export_batches_campaign_id_idx" ON "export_batches"("campaign_id");

CREATE TABLE "export_batch_visits" (
  "id" UUID NOT NULL,
  "export_batch_id" UUID NOT NULL,
  "visit_log_id" UUID NOT NULL,
  "row_index" INTEGER NOT NULL,
  "row_snapshot_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "export_batch_visits_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "export_batch_visits"
ADD CONSTRAINT "export_batch_visits_export_batch_id_fkey"
FOREIGN KEY ("export_batch_id") REFERENCES "export_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_batch_visits"
ADD CONSTRAINT "export_batch_visits_visit_log_id_fkey"
FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "export_batch_visits_export_batch_id_visit_log_id_key"
ON "export_batch_visits"("export_batch_id", "visit_log_id");

CREATE INDEX "export_batch_visits_visit_log_id_idx" ON "export_batch_visits"("visit_log_id");

DROP INDEX IF EXISTS "outcome_definitions_code_key";
CREATE INDEX "outcome_definitions_organization_id_campaign_id_code_idx"
ON "outcome_definitions"("organization_id", "campaign_id", "code");
