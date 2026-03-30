-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "organization_id" UUID,
    "campaign_id" UUID,
    "initiated_by_user_id" UUID,
    "mode" TEXT NOT NULL,
    "duplicate_strategy" TEXT NOT NULL,
    "turf_name_fallback" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "merged_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_skipped_count" INTEGER NOT NULL DEFAULT 0,
    "mapping_json" JSONB,
    "csv_content" TEXT,
    "sha256_checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch_rows" (
    "id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "turf_name" TEXT,
    "status" TEXT NOT NULL,
    "reason_code" TEXT,
    "raw_row_json" JSONB,
    "address_id" UUID,
    "household_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batch_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_organization_id_idx" ON "import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "import_batches_campaign_id_idx" ON "import_batches"("campaign_id");

-- CreateIndex
CREATE INDEX "import_batches_initiated_by_user_id_idx" ON "import_batches"("initiated_by_user_id");

-- CreateIndex
CREATE INDEX "import_batches_created_at_idx" ON "import_batches"("created_at");

-- CreateIndex
CREATE INDEX "import_batch_rows_import_batch_id_idx" ON "import_batch_rows"("import_batch_id");

-- CreateIndex
CREATE INDEX "import_batch_rows_address_id_idx" ON "import_batch_rows"("address_id");

-- CreateIndex
CREATE INDEX "import_batch_rows_household_id_idx" ON "import_batch_rows"("household_id");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
