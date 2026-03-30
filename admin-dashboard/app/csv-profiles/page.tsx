'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input, Select, TextArea } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { CampaignRecord, CsvProfileDirection, CsvProfileRecord } from '../../src/lib/types';

type CsvProfileForm = {
  code: string;
  name: string;
  description: string;
  campaignId: string;
  isActive: boolean;
  mappingJson: string;
  settingsJson: string;
};

function profileKey(profile: Pick<CsvProfileRecord, 'direction' | 'code' | 'campaignId'>) {
  return `${profile.direction}:${profile.code}:${profile.campaignId ?? 'org'}`;
}

function formatJson(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toForm(profile: CsvProfileRecord): CsvProfileForm {
  return {
    code: profile.code,
    name: profile.name,
    description: profile.description ?? '',
    campaignId: profile.campaignId ?? '',
    isActive: profile.isActive,
    mappingJson: formatJson(profile.mappingJson),
    settingsJson: formatJson(profile.settingsJson)
  };
}

function parseJsonInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return JSON.parse(trimmed) as unknown;
}

export default function CsvProfilesPage() {
  const { user, runSensitiveAction } = useAuth();
  const api = useAuthedApi();
  const isAdmin = user?.role === 'admin';
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [direction, setDirection] = useState<CsvProfileDirection>('import');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [profiles, setProfiles] = useState<CsvProfileRecord[]>([]);
  const [createForm, setCreateForm] = useState<CsvProfileForm>({
    code: '',
    name: '',
    description: '',
    campaignId: '',
    isActive: true,
    mappingJson: '',
    settingsJson: ''
  });
  const [editForms, setEditForms] = useState<Record<string, CsvProfileForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  const campaignOptions = useMemo(
    () =>
      campaigns.map((campaign) => (
        <option key={campaign.id} value={campaign.id}>
          {campaign.name}
          {campaign.isActive ? '' : ' (inactive)'}
        </option>
      )),
    [campaigns]
  );

  const campaignLabel = (campaignId?: string | null) => {
    if (!campaignId) {
      return 'Organization Default';
    }

    return campaignById.get(campaignId)?.name ?? campaignId;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCampaigns, nextProfiles] = await Promise.all([
        api.listCampaigns(),
        api.listCsvProfiles(direction, selectedCampaignId || null)
      ]);
      setCampaigns(nextCampaigns);
      setProfiles(nextProfiles);
      setEditForms(Object.fromEntries(nextProfiles.map((profile) => [profileKey(profile), toForm(profile)])));
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api, direction, selectedCampaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await runSensitiveAction('create a CSV profile', (freshApi) =>
        freshApi.upsertCsvProfile({
          direction,
          code: createForm.code.trim(),
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          campaignId: createForm.campaignId || null,
          isActive: createForm.isActive,
          mappingJson: parseJsonInput(createForm.mappingJson),
          settingsJson: parseJsonInput(createForm.settingsJson)
        })
      );
      setCreateForm({
        code: '',
        name: '',
        description: '',
        campaignId: '',
        isActive: true,
        mappingJson: '',
        settingsJson: ''
      });
      setMessage('CSV profile saved.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(profile: CsvProfileRecord) {
    if (!isAdmin) {
      return;
    }

    const draft = editForms[profileKey(profile)];
    if (!draft) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await runSensitiveAction('save a CSV profile', (freshApi) =>
        freshApi.upsertCsvProfile({
          direction: profile.direction,
          code: profile.code,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          campaignId: draft.campaignId || null,
          isActive: draft.isActive,
          mappingJson: parseJsonInput(draft.mappingJson),
          settingsJson: parseJsonInput(draft.settingsJson)
        })
      );
      setMessage('CSV profile updated.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profile: CsvProfileRecord) {
    if (!isAdmin || !profile.explicitRecord) {
      return;
    }

    const confirmed = window.confirm(`Reset ${profile.code} for ${campaignLabel(profile.campaignId)}?`);
    if (!confirmed) {
      return;
    }

    setDeletingCode(profile.code);
    setError(null);
    setMessage(null);

    try {
      await runSensitiveAction('reset a CSV profile override', (freshApi) =>
        freshApi.deleteCsvProfile(profile.direction, profile.code, profile.campaignId ?? null)
      );
      setMessage('CSV profile override cleared.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setDeletingCode(null);
    }
  }

  async function handleDownloadTemplate(profile: CsvProfileRecord) {
    setDownloadingCode(profile.code);
    setError(null);
    setMessage(null);

    try {
      const result = await api.downloadCsvProfileTemplate(profile.direction, profile.code, profile.campaignId ?? null);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Template downloaded as ${result.filename}.`);
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setDownloadingCode(null);
    }
  }

  return (
    <ProtectedFrame title="CSV Profiles" eyebrow="Configuration">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        {!isAdmin ? (
          <Card>
            <div className="stack">
              <div>
                <p className="section-kicker">Restricted</p>
                <h2 className="heading-reset">CSV profile management is admin only</h2>
              </div>
              <p className="muted">
                Supervisors can use the profiles assigned by policy, but only admins can create, edit, or reset profile definitions.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <form className="stack" onSubmit={handleCreate}>
                <div className="inline-actions inline-actions-between">
                  <div>
                    <p className="section-kicker">Scope</p>
                    <h2 className="heading-reset">Choose profile direction and campaign scope</h2>
                  </div>
                  <Badge tone={direction === 'import' ? 'gold' : 'default'}>
                    {direction === 'import' ? 'Import profiles' : 'Export profiles'}
                  </Badge>
                </div>

                <div className="split">
                  <div className="field-group">
                    <label htmlFor="profile-direction">Direction</label>
                    <Select
                      id="profile-direction"
                      value={direction}
                      onChange={(event) => setDirection(event.target.value as CsvProfileDirection)}
                    >
                      <option value="import">Import</option>
                      <option value="export">Export</option>
                    </Select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="profile-scope">Campaign scope</label>
                    <Select
                      id="profile-scope"
                      value={selectedCampaignId}
                      onChange={(event) => setSelectedCampaignId(event.target.value)}
                    >
                      <option value="">Organization Default</option>
                      {campaignOptions}
                    </Select>
                  </div>
                </div>
              </form>
            </Card>

            <div className="split">
              <Card>
                <form className="stack" onSubmit={handleCreate}>
                  <div>
                    <p className="section-kicker">Create Profile</p>
                    <h2 className="heading-reset">Add or replace a profile definition</h2>
                  </div>

                  <div className="grid two">
                    <div className="field-group">
                      <label htmlFor="create-code">Code</label>
                      <Input
                        id="create-code"
                        value={createForm.code}
                        onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value }))}
                        placeholder="van_default"
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="create-name">Name</label>
                      <Input
                        id="create-name"
                        value={createForm.name}
                        onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Van Default Export"
                        required
                      />
                    </div>
                  </div>

                  <div className="field-group">
                    <label htmlFor="create-description">Description</label>
                    <TextArea
                      id="create-description"
                      value={createForm.description}
                      onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Notes on when this profile should be used"
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="create-campaign">Campaign scope</label>
                    <Select
                      id="create-campaign"
                      value={createForm.campaignId}
                      onChange={(event) => setCreateForm((current) => ({ ...current, campaignId: event.target.value }))}
                    >
                      <option value="">Organization Default</option>
                      {campaignOptions}
                    </Select>
                  </div>

                  <div className="inline-actions">
                    <Button
                      type="button"
                      variant={createForm.isActive ? 'secondary' : 'ghost'}
                      onClick={() => setCreateForm((current) => ({ ...current, isActive: !current.isActive }))}
                    >
                      {createForm.isActive ? 'Active' : 'Inactive'}
                    </Button>
                    <Button type="submit" disabled={saving || loading}>
                      {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </div>

                  <div className="split">
                    <div className="field-group">
                      <label htmlFor="create-mapping-json">Mapping JSON</label>
                      <TextArea
                        id="create-mapping-json"
                        value={createForm.mappingJson}
                        onChange={(event) => setCreateForm((current) => ({ ...current, mappingJson: event.target.value }))}
                        placeholder='{ "householdId": { "source": "vanHouseholdId" } }'
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="create-settings-json">Settings JSON</label>
                      <TextArea
                        id="create-settings-json"
                        value={createForm.settingsJson}
                        onChange={(event) => setCreateForm((current) => ({ ...current, settingsJson: event.target.value }))}
                        placeholder='{ "delimiter": ",", "escape": "\"" }'
                      />
                    </div>
                  </div>
                </form>
              </Card>

              <Card className="stack">
                <div className="inline-actions inline-actions-between">
                  <div>
                    <p className="section-kicker">Profiles</p>
                    <h2 className="heading-reset">Current {direction} profiles</h2>
                  </div>
                  <Button variant="ghost" onClick={() => void load()} disabled={loading}>
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>

                <div className="stack">
                  {profiles.map((profile) => {
                    const key = profileKey(profile);
                    const current = editForms[key] ?? toForm(profile);
                    return (
                      <Card key={key} className="stack card-subtle">
                        <div className="inline-actions inline-actions-between">
                          <div className="stack-tight">
                            <strong>{profile.code}</strong>
                            <div className="muted">{profile.name}</div>
                          </div>
                          <div className="inline-actions">
                            <Badge tone={profile.sourceScope === 'campaign' ? 'gold' : profile.sourceScope === 'organization' ? 'success' : 'default'}>
                              {profile.sourceScope === 'campaign'
                                ? 'Campaign override'
                                : profile.sourceScope === 'organization'
                                  ? 'Organization override'
                                  : 'Built-in default'}
                            </Badge>
                            <Badge tone={profile.isActive ? 'success' : 'warning'}>
                              {profile.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>

                        <div className="muted">
                          Scope: {campaignLabel(profile.campaignId)}
                        </div>
                        {profile.description ? <p className="muted">{profile.description}</p> : null}

                        <div className="grid two">
                          <div className="field-group">
                            <label htmlFor={`name-${key}`}>Name</label>
                            <Input
                              id={`name-${key}`}
                              value={current.name}
                              onChange={(event) =>
                                setEditForms((forms) => ({
                                  ...forms,
                                  [key]: { ...current, name: event.target.value }
                                }))
                              }
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`code-${key}`}>Code</label>
                            <Input id={`code-${key}`} value={current.code} disabled />
                          </div>
                        </div>

                        <div className="field-group">
                          <label htmlFor={`description-${key}`}>Description</label>
                          <TextArea
                            id={`description-${key}`}
                            value={current.description}
                            onChange={(event) =>
                              setEditForms((forms) => ({
                                ...forms,
                                [key]: { ...current, description: event.target.value }
                              }))
                            }
                          />
                        </div>

                        <div className="field-group">
                          <label htmlFor={`campaign-${key}`}>Campaign scope</label>
                          <Select
                            id={`campaign-${key}`}
                            value={current.campaignId}
                            onChange={(event) =>
                              setEditForms((forms) => ({
                                ...forms,
                                [key]: { ...current, campaignId: event.target.value }
                              }))
                            }
                          >
                            <option value="">Organization Default</option>
                            {campaignOptions}
                          </Select>
                        </div>

                        <div className="inline-actions">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleDownloadTemplate(profile)}
                            disabled={downloadingCode === profile.code}
                          >
                            {downloadingCode === profile.code ? 'Downloading...' : 'Download Template'}
                          </Button>
                          <Button
                            type="button"
                            variant={current.isActive ? 'secondary' : 'ghost'}
                            onClick={() =>
                              setEditForms((forms) => ({
                                ...forms,
                                [key]: { ...current, isActive: !current.isActive }
                              }))
                            }
                          >
                            {current.isActive ? 'Active' : 'Inactive'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleSave(profile)}
                            disabled={saving || loading}
                          >
                            {saving ? 'Saving...' : 'Save Profile'}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => void handleDelete(profile)}
                            disabled={deletingCode === profile.code || !profile.explicitRecord}
                          >
                            {deletingCode === profile.code ? 'Resetting...' : profile.explicitRecord ? 'Reset Profile' : 'Built-in'}
                          </Button>
                        </div>

                        <div className="split">
                          <div className="field-group">
                            <label htmlFor={`mapping-${key}`}>Mapping JSON</label>
                            <TextArea
                              id={`mapping-${key}`}
                              value={current.mappingJson}
                              onChange={(event) =>
                                setEditForms((forms) => ({
                                  ...forms,
                                  [key]: { ...current, mappingJson: event.target.value }
                                }))
                              }
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`settings-${key}`}>Settings JSON</label>
                            <TextArea
                              id={`settings-${key}`}
                              value={current.settingsJson}
                              onChange={(event) =>
                                setEditForms((forms) => ({
                                  ...forms,
                                  [key]: { ...current, settingsJson: event.target.value }
                                }))
                              }
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  {!profiles.length ? <div className="empty-state muted">No profiles found for this scope.</div> : null}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </ProtectedFrame>
  );
}
