ALTER TABLE "households"
ADD COLUMN "address_line2" TEXT,
ADD COLUMN "unit" TEXT,
ADD COLUMN "normalized_address_key" TEXT;

ALTER TABLE "addresses"
ADD COLUMN "address_line2" TEXT,
ADD COLUMN "unit" TEXT,
ADD COLUMN "normalized_address_key" TEXT;

UPDATE "households"
SET "normalized_address_key" = CONCAT_WS(
  '|',
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("address_line1", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("address_line2", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("unit", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("city", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("state", '')), '[^a-z0-9]+', ' ', 'g')),
  REGEXP_REPLACE(LOWER(COALESCE("zip", '')), '[^a-z0-9]+', '', 'g')
);

UPDATE "addresses"
SET "normalized_address_key" = CONCAT_WS(
  '|',
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("address_line1", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("address_line2", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("unit", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("city", '')), '[^a-z0-9]+', ' ', 'g')),
  TRIM(REGEXP_REPLACE(LOWER(COALESCE("state", '')), '[^a-z0-9]+', ' ', 'g')),
  REGEXP_REPLACE(LOWER(COALESCE("zip", '')), '[^a-z0-9]+', '', 'g')
);

ALTER TABLE "households"
ALTER COLUMN "normalized_address_key" SET NOT NULL;

ALTER TABLE "addresses"
ALTER COLUMN "normalized_address_key" SET NOT NULL;

CREATE INDEX "households_organization_id_normalized_address_key_idx"
ON "households"("organization_id", "normalized_address_key");

CREATE INDEX "addresses_turf_id_normalized_address_key_idx"
ON "addresses"("turf_id", "normalized_address_key");
