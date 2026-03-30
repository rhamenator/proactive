# Admin Quick Start

## What Admins Can Do

Admins use the web dashboard to:

- sign in
- create or import turfs
- manage teams and region-based operating scopes
- manage field users
- assign or reassign turfs
- manage organization, campaign, team, region, and system-wide operational settings
- review dashboard progress
- review flagged GPS submissions and apply overrides
- review sync conflicts and clear resolved queue items
- manage outcome definitions
- export results

## Sign In

1. Open the admin dashboard in a browser.
2. Enter your admin email and password.
3. Select `Sign In`.
4. If MFA enrollment is required, copy the displayed secret or OTPAuth URI into your authenticator app.
5. Save the one-time backup codes shown after MFA setup.
6. Enter the authenticator code, or a saved backup code on later logins, to finish the session.

If login fails, see [Troubleshooting](/home/rich/dev/proactive/docs/help/troubleshooting.md).

## Manage MFA

1. Open `Account`.
2. Review the current MFA status for the signed-in account.
3. Confirm the unused backup-code count after enrollment.
4. If you need to reset MFA, disable it with your password and a current authenticator code or saved backup code.
5. Sign out and sign back in to re-enroll the authenticator for admin or supervisor accounts.

## Create Or Import A Turf

### Create manually

1. Open `Turfs`.
2. Enter the turf name.
3. Optionally add a description, team, and region code.
4. Save the turf.

### Import from CSV

1. Open `Turfs`.
2. Choose the CSV import option.
3. Select the CSV file.
4. Choose the import profile that best matches the source file, or leave the policy default selected.
5. Choose the target campaign, team, and region when needed.
6. Use `Preview Import` to confirm the profile, headers, fallback turf usage, and row readiness before committing the batch.
7. Review mapping fields if prompted.
8. Start the import.

### Manage CSV Profiles

1. Open `CSV Profiles`.
2. Choose whether you are editing an import profile or export profile.
3. Select the organization default scope or a campaign-specific override scope.
4. Update the mapping JSON and settings JSON for the target profile.
5. Save the override, or reset a scoped override to fall back to the inherited or built-in definition.

Expected minimum address data:

- address line
- city
- state

## Manage Field Users

1. Open `Canvassers`.
2. Create a new field user or edit an existing one.
3. Assign the user to the correct campaign and team scope when appropriate.
4. Confirm the user is active before field use.

## Manage Teams And Scope

1. Open `Teams`.
2. Create teams for the operating structure you want to enforce.
3. Optionally bind a team to a campaign and region code.
4. Keep team status active only while the team should remain assignable.
5. Use `Policies` to choose whether supervisors inherit campaign, team, or region scope.

## Assign A Turf

1. Open `Turfs`.
2. Find the turf you want to assign.
3. Confirm the turf has the correct campaign/team/region scope.
4. Select the canvasser.
5. Save or confirm the assignment.

Turf assignment blocks mismatched team or region pairings when those scopes are present.

## Monitor Progress

Use `Dashboard` to review:

- active canvassers
- total turfs
- address completion
- visit counts

## Review GPS Exceptions

1. Open `GPS Review`.
2. Review flagged or overridden submissions.
3. Confirm the visit notes, address, turf, and canvasser context.
4. Apply an override only when operations staff have validated the submission.

## Review Sync Conflicts

1. Open `Sync Conflicts`.
2. Review the conflict reason, submission metadata, and field context.
3. Enter the operational reason for clearing the item.
4. Resolve the conflict only after staff confirm the record should remain as the system-of-record version.

## Manage Outcome Definitions

1. Open `Outcomes`.
2. Review the active visit outcomes shown to mobile canvassers.
3. Add or edit outcomes as needed.
4. Mark an outcome inactive instead of deleting it when historical records already use it.

## Manage Policies And System Settings

1. Open `Policies`.
2. Use the scoped policy editor to set organization or campaign defaults for field thresholds, auth timing, import behavior, default import/export profile codes, retention defaults, outcome fallback behavior, and supervisor scope mode.
3. Use the `System-Wide` card for deployment-level settings such as auth rate-limiting and retention automation timing.
4. Complete the fresh MFA confirmation step before saving sensitive changes.
5. Use `Reset` when you want a scope to fall back to its inherited settings instead of maintaining a custom override.

## Export Results

1. Open `Exports`.
2. Choose the export profile you want for `Internal Master` or `VAN Results`.
3. Optionally filter to a single turf.
4. Download the generated CSV.
5. Confirm the file contents and review the recorded export batch entry.

Historical note:
- once retention cleanup purges a stored import/export artifact, the batch metadata remains visible for audit purposes but the original CSV download is no longer available.

## Recommended Admin First-Day Checklist

1. Confirm you can sign in.
2. Create one test turf.
3. Assign one canvasser.
4. Verify the canvasser can see the turf on mobile.
5. Submit one test visit.
6. Review the default values in `Policies`, including the `System-Wide` settings card.
7. Export results and confirm the row appears.
