-- CreateTable
CREATE TABLE "operational_policies" (
    "id" UUID NOT NULL,
    "scope_key" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID,
    "default_import_mode" TEXT NOT NULL DEFAULT 'create_only',
    "default_duplicate_strategy" TEXT NOT NULL DEFAULT 'skip',
    "sensitive_mfa_window_minutes" INTEGER NOT NULL DEFAULT 5,
    "retention_archive_days" INTEGER,
    "retention_purge_days" INTEGER,
    "require_archive_reason" BOOLEAN NOT NULL DEFAULT false,
    "allow_org_outcome_fallback" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_policies_scope_key_key" ON "operational_policies"("scope_key");

-- CreateIndex
CREATE INDEX "operational_policies_organization_id_idx" ON "operational_policies"("organization_id");

-- CreateIndex
CREATE INDEX "operational_policies_campaign_id_idx" ON "operational_policies"("campaign_id");

-- AddForeignKey
ALTER TABLE "operational_policies" ADD CONSTRAINT "operational_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_policies" ADD CONSTRAINT "operational_policies_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
