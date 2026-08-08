# Retention And Lifecycle Policy

Retention execution is deliberately narrower than the set of tables that contain lifecycle metadata. A record is eligible only when its own `purgeAt` date is due, it is inside the requesting organization/campaign scope, and its entity type is not explicitly excluded.

## Entity inventory

| Entity | Stage | Preserved | Destructive effect | Dependency rationale |
| --- | --- | --- | --- | --- |
| Deleted field users | Archive | Identity and audit relationships | Marks the user archived/inactive | Visit, assignment, session, and audit foreign keys require the user record. |
| Deleted visit logs | Redact | Outcome, time, turf/address/canvasser identity, idempotency, export trace | Clears notes, coordinates, accuracy, and conflict detail | The visit is operational evidence; sensitive diagnostics need not remain indefinitely. |
| Import batches | Redact | Batch counts, mapping, checksum, row status | Clears source CSV and raw row snapshots | Preserves an auditable import ledger without retaining uploaded personal data. |
| Export batches | Redact | Batch counts, filters, checksum, row links | Clears generated CSV and row snapshots | Preserves an auditable export ledger without retaining the payload. |
| Address requests | Purge | Related audit-log entries | Deletes the request | Request data is transient after its explicit purge date. |
| Expired/revoked authentication and recovery artifacts | Purge | Security audit events | Deletes unusable token/code rows | Tokens have no operational value after expiry, revocation, or use. |
| Turfs, addresses, households, sessions, assignments, corrections, geofence results | Retain | Entire record | None automatically | These records participate in operational history and cascading relationships; automated hard deletion is not currently recoverable safely. |
| Audit logs | Retain | Entire append-only record | None | Audit evidence is never a cleanup target in this policy. |

Archive and soft-delete remain supported through the existing MFA-protected user and turf lifecycle actions. Automated cleanup never silently soft-deletes an active operational record.

## Review and execution

The Retention page is the dry-run view. It shows total due counts, enabled stages, exclusions, and the per-entity batch cap. Manual execution requires fresh MFA and a reason. Immediately before mutation the service selects the exact bounded ID sets and appends a `retention_cleanup_planned` audit event. Completion or failure produces a separate append-only audit event with actor, scope, reason, and counts.

Each entity type is capped by `RETENTION_BATCH_SIZE` (default 500, maximum 1000). Updates include eligibility guards and are safe to retry. Mutations run in one database transaction; a partial database failure rolls back the batch, records a categorized failure event, and releases the in-process retry guard.

Set `RETENTION_EXCLUDED_ENTITY_TYPES` to a comma-separated list when a legal, investigative, or operational hold applies to an entire entity class. Supported values are `users`, `visitLogs`, `addressRequests`, `importBatches`, `exportBatches`, `refreshTokens`, `activationTokens`, `passwordResetTokens`, `mfaChallenges`, and `usedBackupCodes`. Exclusions affect both preview counts and execution. Deployment operators must record the hold and its removal through their change-control system.

## Recovery limits

- Archive changes preserve the record and can be reviewed, but there is no automated unarchive operation in the retention job.
- Redacted CSV payloads, raw import rows, visit notes, GPS coordinates, accuracy, and conflict detail cannot be reconstructed from retained metadata.
- Purged address requests and credential artifacts cannot be restored by the application.
- Database backup restoration is an infrastructure operation and may reintroduce data that policy had already removed. Re-run a reviewed retention preview after any restore.
- Checksums prove the identity of a removed artifact but do not contain enough information to recreate it.

Keep automation disabled until organization policy, backup handling, exclusions, and the first dry-run counts have been reviewed.
