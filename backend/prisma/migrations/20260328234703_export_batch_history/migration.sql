-- CreateTable
CREATE TABLE "export_batches" (
    "id" UUID NOT NULL,
    "profile_code" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "turf_id" UUID,
    "initiated_by_user_id" UUID,
    "mark_exported" BOOLEAN NOT NULL DEFAULT false,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "filter_scope_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_batches_profile_code_idx" ON "export_batches"("profile_code");

-- CreateIndex
CREATE INDEX "export_batches_turf_id_idx" ON "export_batches"("turf_id");

-- CreateIndex
CREATE INDEX "export_batches_initiated_by_user_id_idx" ON "export_batches"("initiated_by_user_id");

-- CreateIndex
CREATE INDEX "export_batches_created_at_idx" ON "export_batches"("created_at");

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
