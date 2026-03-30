ALTER TABLE "operational_policies"
ALTER COLUMN "supervisor_scope_mode" SET DEFAULT 'team';

UPDATE "operational_policies"
SET "supervisor_scope_mode" = 'team'
WHERE "supervisor_scope_mode" = 'campaign';
