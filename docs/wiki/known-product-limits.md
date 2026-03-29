# Known Product Limits

## Current Role Limitations

- admin dashboard supports `admin` and `supervisor`
- mobile app supports `canvasser` only by design

## Current Workflow Gaps

- no audited visit-correction workflow yet
- no dedicated resolved-conflicts history screen yet
- org-level scope is enforced, but deeper campaign/team/geography scope rules are not yet implemented
- admin MFA is enforced, but recovery codes and richer break-glass support are not yet implemented
- signed mobile binaries still require external Expo/Apple/Google release credentials

## Documentation Cross-Reference

For the formal gap list, see [Gap Analysis](/home/rich/dev/proactive/docs/gap-analysis.md).

## Guidance

Do not write end-user help as if these unfinished workflows already exist. Keep user-facing documents aligned with what the application actually exposes today.
