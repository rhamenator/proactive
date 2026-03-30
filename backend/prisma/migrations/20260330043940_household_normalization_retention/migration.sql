-- AlterTable
ALTER TABLE "address_requests" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "purge_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "added_in_field" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "household_id" UUID,
ADD COLUMN     "purge_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "turfs" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "purge_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "purge_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "visit_logs" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "purge_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "address_line1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "van_household_id" TEXT,
    "van_person_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'csv_import',
    "approval_status" TEXT NOT NULL DEFAULT 'approved',
    "legacy_address_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "delete_reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "purge_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_legacy_address_id_key" ON "households"("legacy_address_id");

-- CreateIndex
CREATE INDEX "households_organization_id_idx" ON "households"("organization_id");

-- CreateIndex
CREATE INDEX "households_organization_id_address_line1_city_state_zip_idx" ON "households"("organization_id", "address_line1", "city", "state", "zip");

-- CreateIndex
CREATE INDEX "households_organization_id_van_household_id_idx" ON "households"("organization_id", "van_household_id");

-- CreateIndex
CREATE INDEX "households_organization_id_van_person_id_idx" ON "households"("organization_id", "van_person_id");

-- CreateIndex
CREATE INDEX "addresses_household_id_idx" ON "addresses"("household_id");

-- CreateIndex
CREATE INDEX "addresses_turf_id_household_id_idx" ON "addresses"("turf_id", "household_id");

INSERT INTO "households" (
    "id",
    "organization_id",
    "address_line1",
    "city",
    "state",
    "zip",
    "latitude",
    "longitude",
    "van_household_id",
    "source",
    "approval_status",
    "legacy_address_id",
    "created_at"
)
SELECT
    "id",
    "organization_id",
    "address_line1",
    "city",
    "state",
    "zip",
    "latitude",
    "longitude",
    "van_id",
    'legacy_backfill',
    'approved',
    "id",
    "created_at"
FROM "addresses";

UPDATE "addresses"
SET "household_id" = "id"
WHERE "household_id" IS NULL;

ALTER TABLE "addresses"
ALTER COLUMN "household_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
