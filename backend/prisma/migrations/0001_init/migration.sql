-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'canvasser');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('assigned', 'active', 'completed', 'removed');

-- CreateEnum
CREATE TYPE "VisitResult" AS ENUM ('knocked', 'lit_drop', 'not_home', 'refused', 'talked_to_voter', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turfs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turfs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "address_line1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "van_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_assignments" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "canvasser_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'assigned',

    CONSTRAINT "turf_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_sessions" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "canvasser_id" UUID NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "start_lat" DECIMAL(9,6),
    "start_lng" DECIMAL(9,6),
    "end_lat" DECIMAL(9,6),
    "end_lng" DECIMAL(9,6),

    CONSTRAINT "turf_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_logs" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "address_id" UUID NOT NULL,
    "canvasser_id" UUID NOT NULL,
    "visit_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "result" "VisitResult" NOT NULL,
    "contact_made" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "van_exported" BOOLEAN NOT NULL DEFAULT false,
    "geofence_validated" BOOLEAN NOT NULL DEFAULT true,
    "geofence_distance_meters" INTEGER,

    CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "addresses_turf_id_idx" ON "addresses"("turf_id");

-- CreateIndex
CREATE INDEX "turf_assignments_turf_id_idx" ON "turf_assignments"("turf_id");

-- CreateIndex
CREATE INDEX "turf_assignments_canvasser_id_idx" ON "turf_assignments"("canvasser_id");

-- CreateIndex
CREATE INDEX "turf_sessions_turf_id_idx" ON "turf_sessions"("turf_id");

-- CreateIndex
CREATE INDEX "turf_sessions_canvasser_id_idx" ON "turf_sessions"("canvasser_id");

-- CreateIndex
CREATE INDEX "visit_logs_turf_id_idx" ON "visit_logs"("turf_id");

-- CreateIndex
CREATE INDEX "visit_logs_address_id_idx" ON "visit_logs"("address_id");

-- CreateIndex
CREATE INDEX "visit_logs_canvasser_id_idx" ON "visit_logs"("canvasser_id");

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_assignments" ADD CONSTRAINT "turf_assignments_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_assignments" ADD CONSTRAINT "turf_assignments_canvasser_id_fkey" FOREIGN KEY ("canvasser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sessions" ADD CONSTRAINT "turf_sessions_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sessions" ADD CONSTRAINT "turf_sessions_canvasser_id_fkey" FOREIGN KEY ("canvasser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_canvasser_id_fkey" FOREIGN KEY ("canvasser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

