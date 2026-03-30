-- AlterTable
ALTER TABLE "export_batches" ADD COLUMN     "purge_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "purge_at" TIMESTAMP(3);
