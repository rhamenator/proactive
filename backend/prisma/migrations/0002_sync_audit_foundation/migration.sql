-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'syncing', 'synced', 'failed', 'conflict');

-- CreateEnum
CREATE TYPE "GpsStatus" AS ENUM ('verified', 'flagged', 'missing', 'low_accuracy');

-- CreateEnum
CREATE TYPE "VisitSource" AS ENUM ('mobile_app', 'web_app', 'csv_import', 'admin_entry');

-- AlterTable
ALTER TABLE "turf_sessions"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "visit_logs"
  ADD COLUMN "session_id" UUID,
  ADD COLUMN "client_created_at" TIMESTAMP(3),
  ADD COLUMN "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "local_record_uuid" TEXT,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "sync_status" "SyncStatus" NOT NULL DEFAULT 'synced',
  ADD COLUMN "sync_conflict_flag" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sync_conflict_reason" TEXT,
  ADD COLUMN "source" "VisitSource" NOT NULL DEFAULT 'mobile_app',
  ADD COLUMN "accuracy_meters" DECIMAL(8,2),
  ADD COLUMN "gps_status" "GpsStatus" NOT NULL DEFAULT 'missing';

-- CreateTable
CREATE TABLE "visit_geofence_results" (
  "id" UUID NOT NULL,
  "visit_log_id" UUID NOT NULL,
  "address_id" UUID NOT NULL,
  "target_latitude" DECIMAL(9,6),
  "target_longitude" DECIMAL(9,6),
  "captured_latitude" DECIMAL(9,6),
  "captured_longitude" DECIMAL(9,6),
  "accuracy_meters" DECIMAL(8,2),
  "distance_from_target_feet" DECIMAL(10,2),
  "validation_radius_feet" INTEGER NOT NULL,
  "gps_status" "GpsStatus" NOT NULL,
  "failure_reason" TEXT,
  "captured_at" TIMESTAMP(3),
  "override_flag" BOOLEAN NOT NULL DEFAULT false,
  "override_reason" TEXT,
  "override_by_user_id" UUID,
  "override_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "visit_geofence_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
  "id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "local_record_uuid" TEXT,
  "idempotency_key" TEXT,
  "event_type" TEXT NOT NULL,
  "sync_status" "SyncStatus" NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "error_code" TEXT,
  "error_message" TEXT,
  "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempted_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action_type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "reason_code" TEXT,
  "reason_text" TEXT,
  "old_values_json" JSONB,
  "new_values_json" JSONB,
  "ip_address" TEXT,
  "device_id" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turf_sessions_status_idx" ON "turf_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "visit_logs_local_record_uuid_key" ON "visit_logs"("local_record_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "visit_logs_idempotency_key_key" ON "visit_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "visit_logs_session_id_idx" ON "visit_logs"("session_id");

-- CreateIndex
CREATE INDEX "visit_logs_sync_status_idx" ON "visit_logs"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "visit_geofence_results_visit_log_id_key" ON "visit_geofence_results"("visit_log_id");

-- CreateIndex
CREATE INDEX "visit_geofence_results_address_id_idx" ON "visit_geofence_results"("address_id");

-- CreateIndex
CREATE INDEX "visit_geofence_results_gps_status_idx" ON "visit_geofence_results"("gps_status");

-- CreateIndex
CREATE INDEX "sync_events_entity_type_entity_id_idx" ON "sync_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sync_events_local_record_uuid_idx" ON "sync_events"("local_record_uuid");

-- CreateIndex
CREATE INDEX "sync_events_sync_status_idx" ON "sync_events"("sync_status");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs"("action_type");

-- AddForeignKey
ALTER TABLE "visit_logs"
  ADD CONSTRAINT "visit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "turf_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_geofence_results"
  ADD CONSTRAINT "visit_geofence_results_visit_log_id_fkey" FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_geofence_results"
  ADD CONSTRAINT "visit_geofence_results_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
