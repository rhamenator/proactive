-- CreateEnum
CREATE TYPE "SupervisorScopeMode" AS ENUM ('campaign', 'team', 'region');

-- AlterTable
ALTER TABLE "address_requests" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "export_batches" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "operational_policies" ADD COLUMN     "supervisor_scope_mode" "SupervisorScopeMode" NOT NULL DEFAULT 'campaign';

-- AlterTable
ALTER TABLE "turf_assignments" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "turf_sessions" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "turfs" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "visit_logs" ADD COLUMN     "region_code" TEXT,
ADD COLUMN     "team_id" UUID;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE INDEX "teams_campaign_id_idx" ON "teams"("campaign_id");

-- CreateIndex
CREATE INDEX "teams_region_code_idx" ON "teams"("region_code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_code_key" ON "teams"("organization_id", "code");

-- CreateIndex
CREATE INDEX "address_requests_team_id_idx" ON "address_requests"("team_id");

-- CreateIndex
CREATE INDEX "address_requests_region_code_idx" ON "address_requests"("region_code");

-- CreateIndex
CREATE INDEX "addresses_team_id_idx" ON "addresses"("team_id");

-- CreateIndex
CREATE INDEX "addresses_region_code_idx" ON "addresses"("region_code");

-- CreateIndex
CREATE INDEX "export_batches_team_id_idx" ON "export_batches"("team_id");

-- CreateIndex
CREATE INDEX "export_batches_region_code_idx" ON "export_batches"("region_code");

-- CreateIndex
CREATE INDEX "import_batches_team_id_idx" ON "import_batches"("team_id");

-- CreateIndex
CREATE INDEX "import_batches_region_code_idx" ON "import_batches"("region_code");

-- CreateIndex
CREATE INDEX "turf_assignments_team_id_idx" ON "turf_assignments"("team_id");

-- CreateIndex
CREATE INDEX "turf_assignments_region_code_idx" ON "turf_assignments"("region_code");

-- CreateIndex
CREATE INDEX "turf_sessions_team_id_idx" ON "turf_sessions"("team_id");

-- CreateIndex
CREATE INDEX "turf_sessions_region_code_idx" ON "turf_sessions"("region_code");

-- CreateIndex
CREATE INDEX "turfs_team_id_idx" ON "turfs"("team_id");

-- CreateIndex
CREATE INDEX "turfs_region_code_idx" ON "turfs"("region_code");

-- CreateIndex
CREATE INDEX "users_team_id_idx" ON "users"("team_id");

-- CreateIndex
CREATE INDEX "users_region_code_idx" ON "users"("region_code");

-- CreateIndex
CREATE INDEX "visit_logs_team_id_idx" ON "visit_logs"("team_id");

-- CreateIndex
CREATE INDEX "visit_logs_region_code_idx" ON "visit_logs"("region_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_assignments" ADD CONSTRAINT "turf_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sessions" ADD CONSTRAINT "turf_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_requests" ADD CONSTRAINT "address_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
