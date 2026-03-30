# Timezone Reconciliation Matrix

Date: 2026-03-30

Purpose: provide a strict spec-vs-runtime view of timestamp semantics across storage, APIs, reporting, exports, and UI display.

## Policy Source Of Truth

- Canonical storage timezone: `UTC`
- Report bucket timezone: `REPORT_BUCKET_TIME_ZONE` (default `UTC`)
- Export timezone label and rendering: `EXPORT_TIME_ZONE` (default `UTC`)
- Shared policy module: `backend/src/common/utils/timezone-policy.util.ts`

## Matrix

| Surface | Field/Output | Runtime Behavior | Timezone Basis | Label Behavior | Source |
|---|---|---|---|---|---|
| Persistence | Prisma `DateTime` fields (visit/audit/session/import/export timestamps) | Stored as absolute instants | UTC canonical | N/A | `backend/prisma/schema.prisma` |
| Reporting API | `trends.bucketTimeZone` | Returned from centralized policy | `REPORT_BUCKET_TIME_ZONE` | Explicit in payload | `backend/src/reports/reports.service.ts` |
| Reporting API | `trends.byTimeOfDay` buckets | Bucket hour uses policy helper | `REPORT_BUCKET_TIME_ZONE` | Bucket zone indicated by `bucketTimeZone` | `backend/src/common/utils/visit-analytics.util.ts` |
| Reporting API | `trends.byDayOfWeek` buckets | Weekday uses policy helper | `REPORT_BUCKET_TIME_ZONE` | Bucket zone indicated by `bucketTimeZone` | `backend/src/common/utils/visit-analytics.util.ts` |
| Reporting API | Date filtering (`dateFrom`/`dateTo`) | Date-only `dateTo` snapped to end-of-UTC-day | UTC for comparisons | N/A | `backend/src/reports/reports.service.ts` |
| Export CSV (VAN) | `visit_time` | Formatted by shared export formatter | `EXPORT_TIME_ZONE` (UTC default) | `time_zone` column from shared label helper | `backend/src/exports/exports.service.ts` |
| Export CSV (VAN) | `time_zone` | Shared label helper | `EXPORT_TIME_ZONE` | Explicit per row | `backend/src/exports/exports.service.ts` |
| Export CSV (Internal) | `visit_time`, `client_created_at`, `server_received_at`, `override_at` | Formatted by shared export formatter | `EXPORT_TIME_ZONE` (UTC default) | `time_zone` column from shared label helper | `backend/src/exports/exports.service.ts` |
| Export CSV (Internal) | `time_zone` | Shared label helper | `EXPORT_TIME_ZONE` | Explicit per row | `backend/src/exports/exports.service.ts` |
| Admin Dashboard UI | Human-readable timestamps | Local browser formatting via `Intl.DateTimeFormat` | Viewer local timezone | Includes timezone abbreviation/name | `admin-dashboard/src/lib/datetime.ts` |
| Admin Dashboard UI | Reports page note | Explicitly tells user timestamps are local and trend buckets use server-provided bucket zone | Mixed display + explicit bucket zone | User-visible text + `bucketTimeZone` | `admin-dashboard/app/reports/page.tsx` |
| Mobile UI | Human-readable timestamps | Local device formatting via `Intl.DateTimeFormat` | Viewer local timezone | Includes timezone abbreviation/name | `mobile-app/src/utils/datetime.ts` |

## Determinism And Anti-Drift Checks

- Export paths now share one formatter and one timezone label helper; VAN and internal exports no longer drift.
- Report bucket labeling no longer depends on hardcoded literals in report service.
- UTC bucket stability is covered by unit tests in `backend/src/common/utils/visit-analytics.util.spec.ts`.
- Export timezone labeling/content regression checks are covered in `backend/src/exports/exports.service.spec.ts`.
- Date-only filter regression checks are covered in `backend/src/reports/reports.service.spec.ts`.

## Current Defaults (No Env Overrides)

- `REPORT_BUCKET_TIME_ZONE=UTC`
- `EXPORT_TIME_ZONE=UTC`

This yields:

- UTC-based reporting buckets
- UTC-formatted export timestamps (`toISOString()` path)
- `time_zone=UTC` in both export types
- Local-time rendering in admin/mobile UI for operator readability