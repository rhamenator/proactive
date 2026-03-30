'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { CampaignRecord, TeamRecord } from '../../src/lib/types';

type TeamForm = {
  code: string;
  name: string;
  campaignId: string;
  regionCode: string;
  isActive: boolean;
};

function toForm(team: TeamRecord): TeamForm {
  return {
    code: team.code,
    name: team.name,
    campaignId: team.campaignId ?? '',
    regionCode: team.regionCode ?? '',
    isActive: team.isActive
  };
}

export default function TeamsPage() {
  const { user, runSensitiveAction } = useAuth();
  const api = useAuthedApi();
  const isAdmin = user?.role === 'admin';
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [form, setForm] = useState<TeamForm>({
    code: '',
    name: '',
    campaignId: '',
    regionCode: '',
    isActive: true
  });
  const [editForms, setEditForms] = useState<Record<string, TeamForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTeams, nextCampaigns] = await Promise.all([api.listTeams(), api.listCampaigns()]);
      setTeams(nextTeams);
      setCampaigns(nextCampaigns);
      setEditForms(Object.fromEntries(nextTeams.map((team) => [team.id, toForm(team)])));
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

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
      return 'All campaigns';
    }
    return campaignById.get(campaignId)?.name ?? campaignId;
  };

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await runSensitiveAction('create a team', (freshApi) =>
        freshApi.createTeam({
          code: form.code.trim(),
          name: form.name.trim(),
          campaignId: form.campaignId || null,
          regionCode: form.regionCode.trim() || null,
          isActive: form.isActive
        })
      );
      setForm({
        code: '',
        name: '',
        campaignId: '',
        regionCode: '',
        isActive: true
      });
      setMessage('Team created.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(teamId: string) {
    if (!isAdmin) {
      return;
    }

    const next = editForms[teamId];
    if (!next) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await runSensitiveAction('update a team', (freshApi) =>
        freshApi.updateTeam(teamId, {
          code: next.code.trim(),
          name: next.name.trim(),
          campaignId: next.campaignId || null,
          regionCode: next.regionCode.trim() || null,
          isActive: next.isActive
        })
      );
      setMessage('Team updated.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedFrame title="Teams" eyebrow="Scope Management">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        {isAdmin ? (
          <Card>
            <form className="stack" onSubmit={handleCreate}>
              <div>
                <p className="section-kicker">Create Team</p>
                <h2 className="heading-reset">Add a new team scope</h2>
              </div>

              <div className="grid two">
                <div className="field-group">
                  <label htmlFor="team-code">Code</label>
                  <Input
                    id="team-code"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    placeholder="TEAM-NORTH"
                    required
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="team-name">Name</label>
                  <Input
                    id="team-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="North Side Team"
                    required
                  />
                </div>
              </div>

              <div className="split">
                <div className="field-group">
                  <label htmlFor="team-campaign">Campaign scope</label>
                  <select
                    id="team-campaign"
                    className="select"
                    value={form.campaignId}
                    onChange={(event) => setForm((current) => ({ ...current, campaignId: event.target.value }))}
                  >
                    <option value="">All campaigns</option>
                    {campaignOptions}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="team-region">Region code</label>
                  <Input
                    id="team-region"
                    value={form.regionCode}
                    onChange={(event) => setForm((current) => ({ ...current, regionCode: event.target.value }))}
                    placeholder="e.g. NORTH-1"
                  />
                </div>
              </div>

              <div className="inline-actions inline-actions-between">
                <Button
                  type="button"
                  variant={form.isActive ? 'secondary' : 'ghost'}
                  onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                >
                  {form.isActive ? 'Active' : 'Inactive'}
                </Button>
                <Button type="submit" disabled={saving || loading}>
                  {saving ? 'Saving...' : 'Create Team'}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card>
            <div className="stack">
              <div>
                <p className="section-kicker">Read-only</p>
                <h2 className="heading-reset">Team directory</h2>
              </div>
              <p className="muted">
                Supervisors can review the team directory, but only admins can create or update team scopes.
              </p>
            </div>
          </Card>
        )}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Teams</p>
              <h2 className="heading-reset">Scope registry</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <div className="stack">
            {teams.map((team) => {
              const current = editForms[team.id] ?? toForm(team);
              return (
                <Card key={team.id} className="stack card-subtle">
                  <div className="inline-actions inline-actions-between">
                    <div className="stack-tight">
                      <strong>
                        {team.name}
                      </strong>
                      <div className="muted">{team.code}</div>
                    </div>
                    <Badge tone={team.isActive ? 'success' : 'warning'}>
                      {team.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="muted">
                    Campaign scope: {campaignLabel(team.campaignId)}
                  </div>
                  <div className="muted">
                    Region scope: {team.regionCode || 'All regions'}
                  </div>

                  {isAdmin ? (
                    <div className="stack">
                      <div className="grid two">
                        <div className="field-group">
                          <label htmlFor={`edit-code-${team.id}`}>Code</label>
                          <Input
                            id={`edit-code-${team.id}`}
                            value={current.code}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              setEditForms((forms) => ({
                                ...forms,
                                [team.id]: { ...current, code: event.target.value }
                              }))
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label htmlFor={`edit-name-${team.id}`}>Name</label>
                          <Input
                            id={`edit-name-${team.id}`}
                            value={current.name}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              setEditForms((forms) => ({
                                ...forms,
                                [team.id]: { ...current, name: event.target.value }
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="split">
                        <div className="field-group">
                          <label htmlFor={`edit-campaign-${team.id}`}>Campaign scope</label>
                          <select
                            id={`edit-campaign-${team.id}`}
                            className="select"
                            value={current.campaignId}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              setEditForms((forms) => ({
                                ...forms,
                                [team.id]: { ...current, campaignId: event.target.value }
                              }))
                            }
                          >
                            <option value="">All campaigns</option>
                            {campaignOptions}
                          </select>
                        </div>
                        <div className="field-group">
                          <label htmlFor={`edit-region-${team.id}`}>Region code</label>
                          <Input
                            id={`edit-region-${team.id}`}
                            value={current.regionCode}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              setEditForms((forms) => ({
                                ...forms,
                                [team.id]: { ...current, regionCode: event.target.value }
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="inline-actions inline-actions-between">
                        <Button
                          type="button"
                          variant={current.isActive ? 'secondary' : 'ghost'}
                          onClick={() =>
                            setEditForms((forms) => ({
                              ...forms,
                              [team.id]: { ...current, isActive: !current.isActive }
                            }))
                          }
                        >
                          {current.isActive ? 'Active' : 'Inactive'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => void handleSave(team.id)} disabled={saving || loading}>
                          {saving ? 'Saving...' : 'Save Team'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}

            {!teams.length ? <div className="empty-state muted">No teams found.</div> : null}
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
