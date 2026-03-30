'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input, Select } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { CampaignRecord, OperationalPolicyRecord } from '../../src/lib/types';

type PolicyForm = {
  defaultImportMode: OperationalPolicyRecord['defaultImportMode'];
  defaultDuplicateStrategy: OperationalPolicyRecord['defaultDuplicateStrategy'];
  sensitiveMfaWindowMinutes: number;
  canvasserCorrectionWindowMinutes: number;
  maxAttemptsPerHousehold: number;
  minMinutesBetweenAttempts: number;
  geofenceRadiusFeet: number;
  gpsLowAccuracyMeters: number;
  refreshTokenTtlDays: number;
  activationTokenTtlHours: number;
  passwordResetTtlMinutes: number;
  loginLockoutThreshold: number;
  loginLockoutMinutes: number;
  mfaChallengeTtlMinutes: number;
  mfaBackupCodeCount: number;
  retentionArchiveDays: string;
  retentionPurgeDays: string;
  requireArchiveReason: boolean;
  allowOrgOutcomeFallback: boolean;
};

function toForm(policy: OperationalPolicyRecord): PolicyForm {
  return {
    defaultImportMode: policy.defaultImportMode,
    defaultDuplicateStrategy: policy.defaultDuplicateStrategy,
    sensitiveMfaWindowMinutes: policy.sensitiveMfaWindowMinutes,
    canvasserCorrectionWindowMinutes: policy.canvasserCorrectionWindowMinutes,
    maxAttemptsPerHousehold: policy.maxAttemptsPerHousehold,
    minMinutesBetweenAttempts: policy.minMinutesBetweenAttempts,
    geofenceRadiusFeet: policy.geofenceRadiusFeet,
    gpsLowAccuracyMeters: policy.gpsLowAccuracyMeters,
    refreshTokenTtlDays: policy.refreshTokenTtlDays,
    activationTokenTtlHours: policy.activationTokenTtlHours,
    passwordResetTtlMinutes: policy.passwordResetTtlMinutes,
    loginLockoutThreshold: policy.loginLockoutThreshold,
    loginLockoutMinutes: policy.loginLockoutMinutes,
    mfaChallengeTtlMinutes: policy.mfaChallengeTtlMinutes,
    mfaBackupCodeCount: policy.mfaBackupCodeCount,
    retentionArchiveDays: policy.retentionArchiveDays ? String(policy.retentionArchiveDays) : '',
    retentionPurgeDays: policy.retentionPurgeDays ? String(policy.retentionPurgeDays) : '',
    requireArchiveReason: policy.requireArchiveReason,
    allowOrgOutcomeFallback: policy.allowOrgOutcomeFallback
  };
}

export default function PoliciesPage() {
  const { user, runSensitiveAction } = useAuth();
  const api = useAuthedApi();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [policy, setPolicy] = useState<OperationalPolicyRecord | null>(null);
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isScopedUser = Boolean(user?.campaignId);

  const scopeLabel = useMemo(() => {
    if (!selectedCampaignId) {
      return 'Organization Default';
    }

    return campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name ?? 'Campaign Override';
  }, [campaigns, selectedCampaignId]);

  const loadPolicy = useCallback(async (campaignId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const nextPolicy = await api.getOperationalPolicy(campaignId ?? null);
      setPolicy(nextPolicy);
      setForm(toForm(nextPolicy));
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const nextCampaigns = await api.listCampaigns();
        setCampaigns(nextCampaigns);
      } catch (value) {
        setError(getErrorMessage(value));
      }
    }

    void load();
  }, [api]);

  useEffect(() => {
    if (user?.campaignId) {
      setSelectedCampaignId(user.campaignId);
      return;
    }
    setSelectedCampaignId('');
  }, [user?.campaignId]);

  useEffect(() => {
    void loadPolicy(selectedCampaignId || null);
  }, [loadPolicy, selectedCampaignId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || !form) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        campaignId: selectedCampaignId || null,
        defaultImportMode: form.defaultImportMode,
        defaultDuplicateStrategy: form.defaultDuplicateStrategy,
        sensitiveMfaWindowMinutes: form.sensitiveMfaWindowMinutes,
        canvasserCorrectionWindowMinutes: form.canvasserCorrectionWindowMinutes,
        maxAttemptsPerHousehold: form.maxAttemptsPerHousehold,
        minMinutesBetweenAttempts: form.minMinutesBetweenAttempts,
        geofenceRadiusFeet: form.geofenceRadiusFeet,
        gpsLowAccuracyMeters: form.gpsLowAccuracyMeters,
        refreshTokenTtlDays: form.refreshTokenTtlDays,
        activationTokenTtlHours: form.activationTokenTtlHours,
        passwordResetTtlMinutes: form.passwordResetTtlMinutes,
        loginLockoutThreshold: form.loginLockoutThreshold,
        loginLockoutMinutes: form.loginLockoutMinutes,
        mfaChallengeTtlMinutes: form.mfaChallengeTtlMinutes,
        mfaBackupCodeCount: form.mfaBackupCodeCount,
        retentionArchiveDays: form.retentionArchiveDays ? Number(form.retentionArchiveDays) : null,
        retentionPurgeDays: form.retentionPurgeDays ? Number(form.retentionPurgeDays) : null,
        requireArchiveReason: form.requireArchiveReason,
        allowOrgOutcomeFallback: form.allowOrgOutcomeFallback
      };
      const updated = await runSensitiveAction('save policy changes', (freshApi) => freshApi.updateOperationalPolicy(payload));
      setPolicy(updated);
      setForm(toForm(updated));
      setMessage(`Policy saved for ${selectedCampaignId ? 'the selected campaign override' : 'the organization default'}.`);
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearOverride() {
    if (!isAdmin || !policy?.explicitRecord) {
      return;
    }

    setResetting(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await runSensitiveAction('clear policy override', (freshApi) =>
        freshApi.clearOperationalPolicy(selectedCampaignId || null)
      );
      setPolicy(updated);
      setForm(toForm(updated));
      setMessage(
        selectedCampaignId
          ? 'Campaign policy override cleared. The campaign now inherits the organization/default policy.'
          : 'Organization policy cleared. Environment defaults are now in effect.'
      );
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setResetting(false);
    }
  }

  return (
    <ProtectedFrame title="Policies" eyebrow="Operational Configuration">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="split">
          <Card className="stack">
            <div className="inline-actions inline-actions-between">
              <div>
                <p className="section-kicker">Scope</p>
                <h2 className="heading-reset">Current policy source</h2>
              </div>
              {policy ? (
                <Badge tone={policy.sourceScope === 'campaign' ? 'gold' : policy.sourceScope === 'organization' ? 'success' : 'warning'}>
                  {policy.sourceScope === 'campaign'
                    ? 'Campaign Override'
                    : policy.sourceScope === 'organization'
                      ? 'Organization Policy'
                      : 'Environment Default'}
                </Badge>
              ) : null}
            </div>

            {!isScopedUser ? (
              <div className="field-group">
                <label htmlFor="policy-scope">Policy scope</label>
                <Select
                  id="policy-scope"
                  value={selectedCampaignId}
                  onChange={(event) => {
                    setSelectedCampaignId(event.target.value);
                    setMessage(null);
                  }}
                >
                  <option value="">Organization Default</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="notice notice-warning">
                This account is campaign-scoped. Policy edits apply only to the current campaign.
              </div>
            )}

            <p className="muted">
              Editing <strong>{scopeLabel}</strong>.
              {policy?.inheritedFromOrganization ? ' This campaign currently inherits the organization defaults.' : null}
              {!policy?.explicitRecord && policy?.sourceScope === 'default' ? ' No saved policy exists yet, so environment defaults are in effect.' : null}
            </p>
          </Card>

          <Card>
            {form ? (
              <form className="stack" onSubmit={handleSubmit}>
                <div>
                  <p className="section-kicker">{isAdmin ? 'Configurable Defaults' : 'Read-only'}</p>
                  <h2 className="heading-reset">Operational rules that may change later</h2>
                </div>

                <div className="field-group">
                  <label htmlFor="import-mode">Default import mode</label>
                  <Select
                    id="import-mode"
                    value={form.defaultImportMode}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      setForm((current) => current ? { ...current, defaultImportMode: event.target.value as PolicyForm['defaultImportMode'] } : current)
                    }
                  >
                    <option value="replace_turf_membership">Replace turf membership only</option>
                    <option value="create_only">Create only</option>
                    <option value="upsert">Upsert</option>
                  </Select>
                </div>

                <div className="field-group">
                  <label htmlFor="duplicate-strategy">Default duplicate handling</label>
                  <Select
                    id="duplicate-strategy"
                    value={form.defaultDuplicateStrategy}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      setForm((current) => current ? { ...current, defaultDuplicateStrategy: event.target.value as PolicyForm['defaultDuplicateStrategy'] } : current)
                    }
                  >
                    <option value="skip">Skip duplicates</option>
                    <option value="error">Error on duplicate</option>
                    <option value="merge">Merge duplicate rows</option>
                    <option value="review">Queue duplicate rows for review</option>
                  </Select>
                </div>

                <div className="field-group">
                  <label htmlFor="mfa-window">Sensitive-action MFA window (minutes)</label>
                  <Input
                    id="mfa-window"
                    type="number"
                    min={1}
                    value={String(form.sensitiveMfaWindowMinutes)}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      setForm((current) => current ? { ...current, sensitiveMfaWindowMinutes: Number(event.target.value || 1) } : current)
                    }
                  />
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="correction-window">Canvasser correction window (minutes)</label>
                    <Input
                      id="correction-window"
                      type="number"
                      min={1}
                      value={String(form.canvasserCorrectionWindowMinutes)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, canvasserCorrectionWindowMinutes: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="max-attempts">Maximum attempts per household</label>
                    <Input
                      id="max-attempts"
                      type="number"
                      min={1}
                      value={String(form.maxAttemptsPerHousehold)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, maxAttemptsPerHousehold: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="between-attempts">Minimum minutes between attempts</label>
                    <Input
                      id="between-attempts"
                      type="number"
                      min={1}
                      value={String(form.minMinutesBetweenAttempts)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, minMinutesBetweenAttempts: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="geofence-radius">Geofence radius (feet)</label>
                    <Input
                      id="geofence-radius"
                      type="number"
                      min={1}
                      value={String(form.geofenceRadiusFeet)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, geofenceRadiusFeet: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="gps-low-accuracy">Low-accuracy threshold (meters)</label>
                  <Input
                    id="gps-low-accuracy"
                    type="number"
                    min={1}
                    value={String(form.gpsLowAccuracyMeters)}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, gpsLowAccuracyMeters: Number(event.target.value || 1) } : current
                      )
                    }
                  />
                </div>

                <div>
                  <p className="section-kicker">Authentication And Recovery</p>
                  <h3 className="heading-reset-tight">Credential timing and lockout defaults</h3>
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="refresh-ttl-days">Refresh token TTL (days)</label>
                    <Input
                      id="refresh-ttl-days"
                      type="number"
                      min={1}
                      value={String(form.refreshTokenTtlDays)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, refreshTokenTtlDays: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="activation-ttl-hours">Activation token TTL (hours)</label>
                    <Input
                      id="activation-ttl-hours"
                      type="number"
                      min={1}
                      value={String(form.activationTokenTtlHours)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, activationTokenTtlHours: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="password-reset-ttl">Password reset TTL (minutes)</label>
                    <Input
                      id="password-reset-ttl"
                      type="number"
                      min={1}
                      value={String(form.passwordResetTtlMinutes)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, passwordResetTtlMinutes: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="mfa-challenge-ttl">MFA challenge TTL (minutes)</label>
                    <Input
                      id="mfa-challenge-ttl"
                      type="number"
                      min={1}
                      value={String(form.mfaChallengeTtlMinutes)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, mfaChallengeTtlMinutes: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="lockout-threshold">Login lockout threshold (attempts)</label>
                    <Input
                      id="lockout-threshold"
                      type="number"
                      min={1}
                      value={String(form.loginLockoutThreshold)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, loginLockoutThreshold: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="lockout-minutes">Login lockout duration (minutes)</label>
                    <Input
                      id="lockout-minutes"
                      type="number"
                      min={1}
                      value={String(form.loginLockoutMinutes)}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, loginLockoutMinutes: Number(event.target.value || 1) } : current
                        )
                      }
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="backup-code-count">Backup code count</label>
                  <Input
                    id="backup-code-count"
                    type="number"
                    min={1}
                    value={String(form.mfaBackupCodeCount)}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, mfaBackupCodeCount: Number(event.target.value || 1) } : current
                      )
                    }
                  />
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="archive-days">Archive after days</label>
                    <Input
                      id="archive-days"
                      type="number"
                      min={1}
                      value={form.retentionArchiveDays}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) => current ? { ...current, retentionArchiveDays: event.target.value } : current)
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="purge-days">Purge after days</label>
                    <Input
                      id="purge-days"
                      type="number"
                      min={1}
                      value={form.retentionPurgeDays}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setForm((current) => current ? { ...current, retentionPurgeDays: event.target.value } : current)
                      }
                    />
                  </div>
                </div>

                <div className="inline-actions">
                  <Button
                    type="button"
                    variant={form.requireArchiveReason ? 'secondary' : 'ghost'}
                    onClick={() =>
                      setForm((current) => current ? { ...current, requireArchiveReason: !current.requireArchiveReason } : current)
                    }
                    disabled={!isAdmin}
                  >
                    {form.requireArchiveReason ? 'Archive reason required' : 'Archive reason optional'}
                  </Button>
                  <Button
                    type="button"
                    variant={form.allowOrgOutcomeFallback ? 'secondary' : 'ghost'}
                    onClick={() =>
                      setForm((current) => current ? { ...current, allowOrgOutcomeFallback: !current.allowOrgOutcomeFallback } : current)
                    }
                    disabled={!isAdmin}
                  >
                    {form.allowOrgOutcomeFallback ? 'Org outcome fallback enabled' : 'Campaign outcomes only'}
                  </Button>
                </div>

                <p className="muted">
                  These defaults control import behavior, field visit rules, authentication and recovery timing, sensitive-action MFA freshness, retention planning, and whether campaign users inherit organization-level outcome definitions.
                </p>

                {isAdmin ? (
                  <div className="inline-actions">
                    <Button type="submit" disabled={saving || resetting}>
                      {saving ? 'Saving...' : 'Save Policy'}
                    </Button>
                    {policy?.explicitRecord ? (
                      <Button type="button" variant="secondary" onClick={handleClearOverride} disabled={saving || resetting}>
                        {resetting
                          ? 'Clearing...'
                          : selectedCampaignId
                            ? 'Clear Campaign Override'
                            : 'Clear Organization Policy'}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => policy ? setForm(toForm(policy)) : null}
                      disabled={saving || resetting}
                    >
                      Reset Form
                    </Button>
                  </div>
                ) : (
                  <div className="notice notice-warning">
                    Supervisors can review policy values, but only admins can change them.
                  </div>
                )}
              </form>
            ) : (
              <div className="empty-state muted">{loading ? 'Loading policy...' : 'Policy configuration is unavailable.'}</div>
            )}
          </Card>
        </div>
      </div>
    </ProtectedFrame>
  );
}
