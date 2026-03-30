# Known Product Limits

## Current Role Limitations

- admin dashboard supports `admin` and `supervisor`
- mobile app supports `canvasser` only by design
- impersonated `canvasser` sessions in the dashboard are intentionally limited to the field-preview/account experience, not the full admin navigation surface

## Current Workflow Gaps

- no dedicated resolved-conflicts history screen yet
- more specialized geography hierarchy beyond the current campaign/team/region scope model is not yet implemented
- reporting is operational and filtered, but not yet the full long-range analytics suite described by the client
- MFA backup codes are implemented, but richer break-glass support is not yet implemented
- signed mobile binaries still require external Expo/Apple/Google release credentials

## Documentation Cross-Reference

For the formal gap list, see [Gap Analysis](/home/rich/dev/proactive/docs/gap-analysis.md).

## Guidance

Do not write end-user help as if these unfinished workflows already exist. Keep user-facing documents aligned with what the application actually exposes today.
