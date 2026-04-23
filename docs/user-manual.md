# User Manual

This manual covers the normal PROACTIVE workflow for admins, supervisors, and canvassers.

## Roles

- Admins configure the system, manage users, import turf, assign work, review exceptions, and export results.
- Supervisors use the dashboard for operational review within the scope assigned by the organization.
- Canvassers use the mobile app to complete assigned turf and submit visit outcomes.

## Admin Workflow

### Sign In

1. Open the admin dashboard.
2. Enter your admin email and password.
3. Complete MFA setup or verification if prompted.
4. Save backup codes when they are displayed.

### Create Field Users

1. Open `Canvassers`.
2. Create or edit the field user.
3. Assign campaign, team, or region scope when needed.
4. Confirm the account is active.

### Manage Teams And Scope

1. Open `Teams`.
2. Create the teams that match the field operation.
3. Add campaign or region metadata when those controls are used.
4. Keep teams active only while they should be assignable.
5. Review supervisor scope rules in `Policies` before assigning restricted users.

### Create Or Import Turf

Manual turf:

1. Open `Turfs`.
2. Enter the turf name and optional description.
3. Assign team or region metadata if your operation uses scope controls.
4. Save the turf.

CSV import:

1. Open `Turfs`.
2. Choose CSV import.
3. Select the CSV file.
4. Select the import profile.
5. Preview the import.
6. Confirm mappings and start the import.

Minimum address fields are address line, city, and state.

### Manage CSV Profiles

1. Open `CSV Profiles`.
2. Choose import or export profile settings.
3. Select organization-wide defaults or a campaign-specific override.
4. Download the template when preparing a new file source.
5. Save mapping and settings changes only after confirming the expected CSV headers.

### Assign Turf

1. Open `Turfs`.
2. Select the turf.
3. Choose the canvasser.
4. Save the assignment.

The system blocks assignments that violate campaign, team, or region scope.

### Monitor Field Progress

Use `Dashboard` to review:

- active canvassers
- assigned turfs
- address completion
- visit counts
- operational exceptions

Use `Reports` for deeper review:

- overview totals
- productivity views
- GPS exception reporting
- audit activity
- trends by time or day
- resolved conflict reporting
- export-batch analytics

### Review GPS Exceptions

1. Open `GPS Review`.
2. Review the visit, address, turf, canvasser, GPS status, and notes.
3. Apply an override only after operations staff verify the submission.

### Review Sync Conflicts

1. Open `Sync Conflicts`.
2. Read the conflict reason and submission context.
3. Decide which record should remain authoritative.
4. Enter the operational reason.
5. Resolve the conflict.

### Review Import Duplicates

1. Open `Import Reviews`.
2. Review duplicate or deferred import rows.
3. Compare the incoming row with the existing household or turf record.
4. Resolve the item according to the campaign data policy.

### Review Address Requests

1. Open `Address Requests`.
2. Review addresses submitted from the field.
3. Confirm whether the address belongs in the campaign or turf.
4. Approve, reject, or route the request according to the operation policy.

### Review Visit Corrections

1. Open `Visit Corrections`.
2. Review the original visit, requested change, requester, and reason.
3. Approve only when the correction is operationally valid.
4. Reject changes that would obscure audit history or create incorrect results.

### Export Results

1. Open `Exports`.
2. Choose the export profile, such as `Internal Master` or `VAN Results`.
3. Apply a turf filter if needed.
4. Download the CSV.
5. Confirm the export appears in recent export batches.

### Manage Outcomes

1. Open `Outcomes`.
2. Review the available visit outcomes shown to canvassers.
3. Add or edit outcomes when campaign policy changes.
4. Mark old outcomes inactive instead of deleting them when historical visits already use them.

### Manage Policies

1. Open `Policies`.
2. Review defaults for GPS thresholds, attempt limits, auth timing, import behavior, retention, and scope rules.
3. Save organization or campaign overrides only when they are intentional.
4. Complete fresh MFA confirmation when prompted for sensitive changes.

### Manage Retention

1. Open `Retention`.
2. Review retention status and cleanup settings.
3. Confirm that any archive or deletion action matches the organization policy.
4. Keep export/import audit metadata even when stored CSV payloads are no longer retained.

### Preview Field Experience

Use `Field Preview` to inspect what a canvasser should see before sending users into the field. This is useful after importing turf, changing outcomes, or adjusting policy settings.

## Supervisor Workflow

1. Sign in to the dashboard.
2. Review the dashboard for assigned campaign, team, or region scope.
3. Monitor turf progress.
4. Review GPS exceptions and sync conflicts when permitted.
5. Coordinate with admins for user, policy, or scope changes outside your access.

Supervisors may see a narrower set of records than admins. If expected data is missing, confirm the supervisor campaign, team, and region scope before treating it as a data problem.

## Canvasser Workflow

### Sign In

1. Open the mobile app.
2. Enter your canvasser email and password.
3. Sign in.

The mobile app is for canvasser accounts only. Admins and supervisors use the dashboard.

### Before Field Work

Confirm:

- your device is charged
- location services are enabled
- the app has location permission
- your assigned turf is visible
- you can reach the network before leaving, when possible

### Start A Turf

1. Open the assigned turf.
2. Select `Start`.
3. Allow location access if prompted.

### Log A Visit

1. Open a household record.
2. Choose the visit outcome.
3. Add notes if needed.
4. Submit the visit.

If the device is offline, the app queues the visit locally and retries sync later.

### Request A Missing Address

1. Open the address request flow when a household is missing from the assigned turf.
2. Enter the requested address details.
3. Submit the request.
4. Continue canvassing assigned addresses unless instructed otherwise.

Admins or supervisors review address requests before they become authoritative campaign data.

### Pause, Resume, And Complete

1. Select `Pause` when stopping temporarily.
2. Select `Resume` when returning to the turf.
3. Select `Complete` when the turf is finished.

### Offline Use

Expected offline behavior:

- assigned turf remains available from local storage
- visits save to the local queue
- sync retries when connectivity returns
- unresolved server conflicts may appear later for admin review

Do not uninstall the app while visits are queued.

### Queue And Sync

1. Open the queue screen if pending work remains.
2. Reconnect to the network.
3. Keep the app open long enough for retries to complete.
4. Escalate if the same item remains stuck after connectivity is restored.

### Performance And Notes

Use the performance screen to review personal progress where enabled. Use session notes for operational notes that help supervisors understand field context.

## First-Day Checklist

Admins:

- Sign in and complete MFA.
- Create or import one test turf.
- Create or confirm one canvasser account.
- Assign the test turf.
- Review policy defaults and outcomes.
- Confirm one mobile visit appears in the dashboard.
- Export results and check the CSV.

Canvassers:

- Sign in before going into the field.
- Confirm assigned turf appears.
- Allow location permission.
- Submit one test visit if instructed.
- Confirm pending sync is clear before ending the day.

## Getting Help

Use [Troubleshooting](help/troubleshooting.md) for common issues. Escalate to the implementation team if login, turf loading, exports, or sync fails for multiple users.
