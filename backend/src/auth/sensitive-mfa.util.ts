export function getSensitiveMfaWindowMinutes() {
  return Number(process.env.SENSITIVE_MFA_TTL_MINUTES ?? process.env.SENSITIVE_ACTION_MFA_WINDOW_MINUTES ?? 5);
}
