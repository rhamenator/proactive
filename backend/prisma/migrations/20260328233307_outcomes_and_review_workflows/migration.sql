-- DropIndex
DROP INDEX "turf_assignments_assigned_by_user_id_idx";

-- DropIndex
DROP INDEX "turfs_status_idx";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "turf_assignments" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "turf_sessions" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "turfs" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "visit_logs" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "outcome_code" TEXT NOT NULL DEFAULT 'knocked',
ADD COLUMN     "outcome_definition_id" UUID,
ADD COLUMN     "outcome_label" TEXT NOT NULL DEFAULT 'Knocked';

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "campaign_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requires_note" BOOLEAN NOT NULL DEFAULT false,
    "is_final_disposition" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_idx" ON "campaigns"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_organization_id_code_key" ON "campaigns"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "outcome_definitions_code_key" ON "outcome_definitions"("code");

-- CreateIndex
CREATE INDEX "outcome_definitions_organization_id_idx" ON "outcome_definitions"("organization_id");

-- CreateIndex
CREATE INDEX "outcome_definitions_campaign_id_idx" ON "outcome_definitions"("campaign_id");

-- CreateIndex
CREATE INDEX "outcome_definitions_is_active_display_order_idx" ON "outcome_definitions"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "addresses_organization_id_idx" ON "addresses"("organization_id");

-- CreateIndex
CREATE INDEX "addresses_campaign_id_idx" ON "addresses"("campaign_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "turf_assignments_organization_id_idx" ON "turf_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "turf_assignments_campaign_id_idx" ON "turf_assignments"("campaign_id");

-- CreateIndex
CREATE INDEX "turf_sessions_organization_id_idx" ON "turf_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "turf_sessions_campaign_id_idx" ON "turf_sessions"("campaign_id");

-- CreateIndex
CREATE INDEX "turfs_organization_id_idx" ON "turfs"("organization_id");

-- CreateIndex
CREATE INDEX "turfs_campaign_id_idx" ON "turfs"("campaign_id");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "visit_logs_organization_id_idx" ON "visit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "visit_logs_campaign_id_idx" ON "visit_logs"("campaign_id");

-- CreateIndex
CREATE INDEX "visit_logs_outcome_definition_id_idx" ON "visit_logs"("outcome_definition_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_definitions" ADD CONSTRAINT "outcome_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_definitions" ADD CONSTRAINT "outcome_definitions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_assignments" ADD CONSTRAINT "turf_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_assignments" ADD CONSTRAINT "turf_assignments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sessions" ADD CONSTRAINT "turf_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sessions" ADD CONSTRAINT "turf_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_outcome_definition_id_fkey" FOREIGN KEY ("outcome_definition_id") REFERENCES "outcome_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
