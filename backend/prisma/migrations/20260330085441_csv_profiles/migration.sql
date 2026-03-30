-- CreateEnum
CREATE TYPE "CsvProfileDirection" AS ENUM ('import', 'export');

-- AlterTable
ALTER TABLE "export_batches" ADD COLUMN     "profile_name" TEXT;

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "profile_code" TEXT NOT NULL DEFAULT 'van_standard',
ADD COLUMN     "profile_name" TEXT;

-- AlterTable
ALTER TABLE "operational_policies" ADD COLUMN     "default_import_profile_code" TEXT NOT NULL DEFAULT 'van_standard',
ADD COLUMN     "default_internal_export_profile_code" TEXT NOT NULL DEFAULT 'internal_master',
ADD COLUMN     "default_van_export_profile_code" TEXT NOT NULL DEFAULT 'van_compatible';

-- CreateTable
CREATE TABLE "csv_profiles" (
    "id" UUID NOT NULL,
    "direction" "CsvProfileDirection" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organization_id" UUID,
    "campaign_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "mapping_json" JSONB,
    "settings_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csv_profiles_direction_organization_id_campaign_id_idx" ON "csv_profiles"("direction", "organization_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "csv_profiles_direction_code_organization_id_campaign_id_key" ON "csv_profiles"("direction", "code", "organization_id", "campaign_id");

-- AddForeignKey
ALTER TABLE "csv_profiles" ADD CONSTRAINT "csv_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_profiles" ADD CONSTRAINT "csv_profiles_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
