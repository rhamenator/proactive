-- AlterTable
ALTER TABLE "import_batch_rows" ADD COLUMN     "candidate_address_id" UUID,
ADD COLUMN     "resolution_action" TEXT,
ADD COLUMN     "resolution_reason" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_user_id" UUID;

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "pending_review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "import_batch_rows_candidate_address_id_idx" ON "import_batch_rows"("candidate_address_id");

-- CreateIndex
CREATE INDEX "import_batch_rows_resolved_by_user_id_idx" ON "import_batch_rows"("resolved_by_user_id");

-- AddForeignKey
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_candidate_address_id_fkey" FOREIGN KEY ("candidate_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
