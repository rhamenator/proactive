# Privileged help-desk and break-glass recovery

## Security policy

Privileged recovery is an exceptional, two-person workflow. It supplements self-service password reset and MFA backup codes; it does not bypass them silently.

Supported actors are active organization administrators using a normal, non-impersonated session with MFA verified inside the configured sensitive-action freshness window. Supervisors, canvassers, inactive admins, impersonated admins, and cross-organization actors cannot request or approve recovery.

Supported case types are:

- `help_desk_mfa_reset` for a supervisor or canvasser who retains their password but has lost the enrolled authenticator.
- `help_desk_account_recovery` for a supervisor or canvasser who needs an independently delivered password-reset token and MFA reset.
- `break_glass_account_recovery` for an administrator. This path is disabled unless `BREAK_GLASS_RECOVERY_ENABLED=true` and always requires a distinct administrator reviewer.

The requester cannot be the affected user. The reviewer cannot be the requester or affected user. A case expires before execution, defaults to 30 minutes, and cannot be replayed. Request and approval reasons must be 10–1000 characters and should reference the approved identity-verification checklist or incident ticket without containing identity documents, passwords, MFA codes, or other secrets.

## Execution effects

Approval performs one transaction that:

- disables the existing MFA enrollment and removes temporary MFA state;
- deletes all MFA backup codes;
- consumes outstanding MFA challenges, activation links, and password-reset links;
- revokes every active refresh token with reason `privileged_recovery`;
- ends active impersonation sessions involving the account;
- clears login lockout counters;
- for account recovery, creates one short-lived password-reset token using the scoped password-reset TTL.

The raw reset token is never returned to the dashboard or written to an audit record. Account recovery will not execute unless `RECOVERY_NOTIFICATION_WEBHOOK_URL` is configured. The webhook is the independent delivery boundary and receives the affected user's email/name, case metadata, event time, and the reset token only when one is required. `RECOVERY_NOTIFICATION_WEBHOOK_TOKEN`, when set, is sent as a bearer credential and is never stored in the case.

MFA-only recovery can execute without a webhook because the user still authenticates with their existing password. If a webhook is configured, the affected user is notified there as well. Notification delivery state is reviewable as `not_configured`, `pending`, `delivered`, or `failed`; raw delivery errors are reduced to `delivery_failed`.

## Rate limits and configuration

- `RECOVERY_RATE_LIMIT_MAX_ATTEMPTS` defaults to 5 per actor/target/action window (1–20).
- `RECOVERY_RATE_LIMIT_WINDOW_MINUTES` defaults to 60 (1–1440).
- `RECOVERY_CASE_TTL_MINUTES` defaults to 30 (5–240).
- `BREAK_GLASS_RECOVERY_ENABLED` defaults to `false`.
- `RECOVERY_NOTIFICATION_WEBHOOK_URL` enables independent notification and account-reset delivery.
- `RECOVERY_NOTIFICATION_WEBHOOK_TOKEN` authenticates to that webhook when configured.

Rate limiting occurs before self-recovery and target validation so repeated abusive probes are still counted.

## Emergency operation

1. Prefer self-service reset or a saved MFA backup code when available.
2. The first admin verifies the requester using the client's approved independent procedure and creates a case in **Account Recovery** with a non-secret evidence/ticket reference.
3. A different admin repeats the verification, checks organization and case type, confirms the notification channel, and records an independent approval reason.
4. Approval executes the revocations. Do not send reset tokens through chat, tickets, or the dashboard; the configured webhook owns independent delivery.
5. Confirm the affected user received the notification, completed password reset if applicable, re-enrolled MFA, and generated new backup codes.
6. If notification shows `failed`, treat the account as security-sensitive: do not copy a token from databases or logs. Correct the channel and start a new case after the old token expires or is invalidated.

## Post-event review

Within one business day, review the recovery case and append-only audit events: `recovery_case_requested`, `recovery_case_approved` or `recovery_case_rejected`, `privileged_recovery_executed`, and notification delivery/failure. Confirm requester and reviewer were distinct, fresh MFA was enforced, no impersonation was active, the target was in the same organization, sessions and artifacts were revoked, and the user re-enrolled MFA.

For break-glass events, also document why normal recovery was unavailable, the interval during which break-glass was enabled, who disabled it afterward, and any credentials or notification integrations that must be rotated. Preserve audit records according to the retention/legal-hold policy; do not attach identity evidence or reset tokens to the repository or case notes.
