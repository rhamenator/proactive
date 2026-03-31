-- First-deployment policy hardening:
-- 1) Remove obsolete campaign supervisor mode from enum values.
-- 2) Align policy default import mode with runtime defaults.

UPDATE "operational_policies"
SET "supervisor_scope_mode" = 'team'
WHERE "supervisor_scope_mode" = 'campaign';

ALTER TABLE "operational_policies"
ALTER COLUMN "default_import_mode" SET DEFAULT 'replace_turf_membership';

ALTER TABLE "operational_policies"
ALTER COLUMN "supervisor_scope_mode" DROP DEFAULT;

CREATE TYPE "SupervisorScopeMode_new" AS ENUM ('team', 'region');

ALTER TABLE "operational_policies"
ALTER COLUMN "supervisor_scope_mode" TYPE "SupervisorScopeMode_new"
USING (
  CASE
    WHEN "supervisor_scope_mode"::text = 'campaign' THEN 'team'
    ELSE "supervisor_scope_mode"::text
  END
)::"SupervisorScopeMode_new";

ALTER TYPE "SupervisorScopeMode" RENAME TO "SupervisorScopeMode_old";
ALTER TYPE "SupervisorScopeMode_new" RENAME TO "SupervisorScopeMode";
DROP TYPE "SupervisorScopeMode_old";

ALTER TABLE "operational_policies"
ALTER COLUMN "supervisor_scope_mode" SET DEFAULT 'team';
