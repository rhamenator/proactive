-- AlterTable
ALTER TABLE "export_batches" ADD COLUMN     "artifact_purged_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "artifact_purged_at" TIMESTAMP(3);
