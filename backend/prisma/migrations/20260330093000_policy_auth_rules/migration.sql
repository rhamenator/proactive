ALTER TABLE "operational_policies"
ADD COLUMN "refresh_token_ttl_days" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN "activation_token_ttl_hours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN "password_reset_ttl_minutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "login_lockout_threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "login_lockout_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "mfa_challenge_ttl_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "mfa_backup_code_count" INTEGER NOT NULL DEFAULT 10;
