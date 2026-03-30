'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { CampaignRecord, FieldUserRecord } from '../../src/lib/types';

const roleLabels: Record<FieldUserRecord['role'], string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  canvasser: 'Canvasser'
};

export default function CanvassersPage() {
  const { user, startImpersonation, impersonation } = useAuth();
  const api = useAuthedApi();
  const isAdmin = user?.role === 'admin';
  const [users, setUsers] = useState<FieldUserRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    campaignId: '',
    role: 'canvasser' as FieldUserRecord['role']
  });
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    campaignId: '',
    role: 'canvasser' as FieldUserRecord['role']
  });
  const [campaignEdits, setCampaignEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextUsers, nextCampaigns] = await Promise.all([api.listCanvassers(), api.listCampaigns()]);
      setUsers(nextUsers);
      setCampaigns(nextCampaigns);
      setCampaignEdits(
        Object.fromEntries(
          nextUsers.map((fieldUser) => [fieldUser.id, fieldUser.campaignId ?? ''])
        )
      );
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await api.createCanvasser(form);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        campaignId: '',
        role: 'canvasser'
      });
      setMessage(`${roleLabels[form.role]} created.`);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function toggleActive(user: FieldUserRecord) {
    setError(null);
    setMessage(null);
    try {
      await api.updateCanvasser(user.id, { isActive: !user.isActive });
      setMessage(`${user.firstName} ${user.lastName} updated.`);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleCampaignUpdate(fieldUser: FieldUserRecord) {
    setError(null);
    setMessage(null);
    try {
      await api.updateCanvasser(fieldUser.id, {
        campaignId: campaignEdits[fieldUser.id] || null
      });
      setMessage(`${fieldUser.firstName} ${fieldUser.lastName} campaign updated.`);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await api.inviteCanvasser({
        ...inviteForm,
        campaignId: inviteForm.campaignId || null
      });
      setInviteForm({
        firstName: '',
        lastName: '',
        email: '',
        campaignId: '',
        role: 'canvasser'
      });
      setMessage(`Invite created for ${inviteForm.firstName} ${inviteForm.lastName}.`);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  const campaignOptions = useMemo(
    () => campaigns.map((campaign) => (
      <option key={campaign.id} value={campaign.id}>
        {campaign.name} {campaign.isActive ? '' : '(inactive)'}
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

  async function handleImpersonate(target: FieldUserRecord) {
    const reason = window.prompt(
      `Start an audited support impersonation session for ${target.firstName} ${target.lastName}. Enter a reason:`,
      'Support investigation'
    );

    if (reason === null) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await startImpersonation(target.id, reason);
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  return (
    <ProtectedFrame title="Field Users" eyebrow="User Management">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="split">
          {isAdmin ? (
          <Card>
            <form className="stack" onSubmit={handleCreate}>
              <div>
                <p className="section-kicker">Add Field User</p>
                <h2 className="heading-reset">Create a supervisor or canvasser</h2>
              </div>

              <div className="grid two">
                <div className="field-group">
                  <label htmlFor="first-name">First name</label>
                  <Input id="first-name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required />
                </div>
                <div className="field-group">
                  <label htmlFor="last-name">Last name</label>
                  <Input id="last-name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="email">Email</label>
                <Input id="email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </div>

              <div className="field-group">
                <label htmlFor="password">Temporary password</label>
                <Input id="password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
              </div>

              <div className="field-group">
                <label htmlFor="campaign-id">Campaign scope</label>
                <select
                  id="campaign-id"
                  className="select"
                  value={form.campaignId}
                  onChange={(event) => setForm((current) => ({ ...current, campaignId: event.target.value }))}
                >
                  <option value="">All campaigns</option>
                  {campaignOptions}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  className="select"
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as FieldUserRecord['role']
                    }))
                  }
                >
                  <option value="canvasser">Canvasser</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>

              <Button type="submit">Create {roleLabels[form.role]}</Button>
            </form>
          </Card>
          ) : (
            <Card>
              <div className="stack">
                <div>
                  <p className="section-kicker">Read-only</p>
                  <h2 className="heading-reset">Supervisor roster view</h2>
                </div>
                <p className="muted">
                  Supervisors can review the field roster here, but only admins can create or modify field users.
                </p>
              </div>
            </Card>
          )}

          {isAdmin ? (
            <Card>
              <form className="stack" onSubmit={handleInvite}>
                <div>
                  <p className="section-kicker">Invite Field User</p>
                  <h2 className="heading-reset">Create an invitation link and scoped account</h2>
                </div>

                <div className="grid two">
                  <div className="field-group">
                    <label htmlFor="invite-first-name">First name</label>
                    <Input
                      id="invite-first-name"
                      value={inviteForm.firstName}
                      onChange={(event) => setInviteForm((current) => ({ ...current, firstName: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="invite-last-name">Last name</label>
                    <Input
                      id="invite-last-name"
                      value={inviteForm.lastName}
                      onChange={(event) => setInviteForm((current) => ({ ...current, lastName: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="invite-email">Email</label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="invite-campaign-id">Campaign scope</label>
                  <select
                    id="invite-campaign-id"
                    className="select"
                    value={inviteForm.campaignId}
                    onChange={(event) => setInviteForm((current) => ({ ...current, campaignId: event.target.value }))}
                  >
                    <option value="">All campaigns</option>
                    {campaignOptions}
                  </select>
                </div>

                <Button type="submit">Invite {roleLabels[inviteForm.role]}</Button>
              </form>
            </Card>
          ) : null}

          <Card className="stack">
            <div className="inline-actions inline-actions-between">
              <div>
                <p className="section-kicker">Roster</p>
                <h2 className="heading-reset">Field staff roster</h2>
              </div>
              <Button variant="ghost" onClick={() => void load()} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            <div className="stack">
              {users.map((user) => (
                <Card key={user.id} className="stack card-subtle">
                  <div className="inline-actions inline-actions-between">
                    <div>
                      <strong>
                        {user.firstName} {user.lastName}
                      </strong>
                      <div className="muted">{user.email}</div>
                    </div>
                    <div className="inline-actions">
                      <Badge tone="default">{roleLabels[user.role]}</Badge>
                      <Badge tone={user.isActive ? 'success' : 'warning'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="muted">
                    Campaign scope: {campaignLabel(user.campaignId)}
                  </div>
                  {isAdmin ? (
                    <div className="field-group">
                      <label htmlFor={`campaign-edit-${user.id}`}>Campaign scope</label>
                      <select
                        id={`campaign-edit-${user.id}`}
                        className="select"
                        value={campaignEdits[user.id] ?? ''}
                        onChange={(event) =>
                          setCampaignEdits((current) => ({
                            ...current,
                            [user.id]: event.target.value
                          }))
                        }
                      >
                        <option value="">All campaigns</option>
                        {campaignOptions}
                      </select>
                    </div>
                  ) : null}
                  {isAdmin ? (
                    <div className="inline-actions">
                      <Button variant="secondary" onClick={() => void handleCampaignUpdate(user)}>
                        Update Campaign
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void handleImpersonate(user)}
                        disabled={Boolean(impersonation)}
                      >
                        Impersonate
                      </Button>
                      <Button variant="secondary" onClick={() => void toggleActive(user)}>
                        {user.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
              {!users.length ? <div className="empty-state muted">No field users found.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </ProtectedFrame>
  );
}
