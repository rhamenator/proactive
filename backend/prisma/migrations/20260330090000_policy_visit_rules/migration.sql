ALTER TABLE "operational_policies"
ADD COLUMN "canvasser_correction_window_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "max_attempts_per_household" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "min_minutes_between_attempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "geofence_radius_feet" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN "gps_low_accuracy_meters" INTEGER NOT NULL DEFAULT 30;
