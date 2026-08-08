# Offline sync diagnostics and safe sharing

## Purpose

The mobile queue records bounded operational evidence for each unsent visit so a canvasser, supervisor, or maintainer can distinguish an offline dependency, authentication problem, server rejection, and manual conflict review. Diagnostics augment the existing local-record UUID and idempotency behavior; they never replace or regenerate those identifiers.

## Recorded fields

Each queued item records its queue age, retry count, last attempt time, last error **category**, current dependency state, whether a server response was received, and a bounded transition list. Transitions contain only timestamp, queue status, category, dependency state, and acknowledgement state.

Raw exception messages, request/response bodies, credentials, authorization headers, tokens, addresses, notes, VAN identifiers, GPS coordinates, and idempotency/local-record identifiers are not copied into diagnostic history.

The defaults are 12 transitions per item and 14 days of transition history. Deployments may configure:

- `EXPO_PUBLIC_SYNC_DIAGNOSTIC_MAX_TRANSITIONS` from 3 through 50.
- `EXPO_PUBLIC_SYNC_DIAGNOSTIC_RETENTION_DAYS` from 1 through 90.

Values outside those bounds are clamped. Current queue state remains available even when older transitions age out.

## Support export

From the mobile **Sync Queue**, choose **Share Redacted Diagnostics**. The `proactive-sync-diagnostics/v1` JSON contains numbered items rather than persistent identifiers. It omits visit content and personal data, and marks material future-clock skew while clamping negative queue age to zero.

The exported file may normally be shared with the project maintainer or authorized client support contact. Before sharing, the operator should still inspect the selected destination and avoid public channels. Screenshots of the full queue screen are less safe because the screen includes addresses; prefer the generated redacted export.

Do not ask users to share the SQLite database, application cache, access token, raw API logs, HTTP captures, CSV source files, or device backups. Those artifacts are outside this diagnostic contract and may contain private client data.

## State interpretation

- `offline` / `network`: the device did not receive an HTTP response. Retrying after connectivity returns is safe.
- `auth_required`: the server returned an authentication failure. Sign in again; repeated blind retries are not useful.
- `server_rejected`: the server responded with validation, authorization, rate-limit, or server failure evidence. The category is retained, not the message.
- `conflict_review`: the server acknowledged the request but idempotency, assignment, or payload conflict rules require admin review.
- `serverAcknowledged: true`: an HTTP response was received. It does not mean the visit was accepted.

Successful items leave the queue. Failed items remain independently, so a partial batch can sync accepted records without losing the evidence or retry identity of the remainder.
