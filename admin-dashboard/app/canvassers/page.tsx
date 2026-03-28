'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { FieldUserRecord } from '../../src/lib/types';

const roleLabels: Record<FieldUserRecord['role'], string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  canvasser: 'Canvasser'
};

export default function CanvassersPage() {
  const { user } = useAuth();
  const api = useAuthedApi();
  const isAdmin = user?.role === 'admin';
  const [users, setUsers] = useState<FieldUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'canvasser' as FieldUserRecord['role']
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.listCanvassers());
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
                    {user.role === 'supervisor'
                      ? 'Supervisor accounts can be assigned field teams once the backend exposes scoped supervision.'
                      : 'Canvasser accounts are field-ready for turf work and visit logging.'}
                  </div>
                  {isAdmin ? (
                    <div className="inline-actions">
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
