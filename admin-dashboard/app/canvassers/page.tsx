'use client';

import { FormEvent, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type { CanvasserRecord } from '../../src/lib/types';

export default function CanvassersPage() {
  const api = useAuthedApi();
  const [canvassers, setCanvassers] = useState<CanvasserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCanvassers(await api.listCanvassers());
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
        password: ''
      });
      setMessage('Canvasser created.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function toggleActive(canvasser: CanvasserRecord) {
    setError(null);
    setMessage(null);
    try {
      await api.updateCanvasser(canvasser.id, { isActive: !canvasser.isActive });
      setMessage(`${canvasser.firstName} ${canvasser.lastName} updated.`);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  return (
    <ProtectedFrame title="Canvassers" eyebrow="User Management">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="split">
          <Card>
            <form className="stack" onSubmit={handleCreate}>
              <div>
                <p className="section-kicker">Add Canvasser</p>
                <h2 style={{ marginTop: 0 }}>Create a field account</h2>
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

              <Button type="submit">Create Canvasser</Button>
            </form>
          </Card>

          <Card className="stack">
            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="section-kicker">Roster</p>
                <h2 style={{ marginTop: 0 }}>Available field staff</h2>
              </div>
              <Button variant="ghost" onClick={() => void load()} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            <div className="stack">
              {canvassers.map((canvasser) => (
                <Card key={canvasser.id} className="stack" style={{ boxShadow: 'none', background: 'var(--surface-strong)' } as React.CSSProperties}>
                  <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <strong>
                        {canvasser.firstName} {canvasser.lastName}
                      </strong>
                      <div className="muted">{canvasser.email}</div>
                    </div>
                    <Badge tone={canvasser.isActive ? 'success' : 'warning'}>
                      {canvasser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="inline-actions">
                    <Button variant="secondary" onClick={() => void toggleActive(canvasser)}>
                      {canvasser.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </div>
                </Card>
              ))}
              {!canvassers.length ? <div className="empty-state muted">No canvassers found.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </ProtectedFrame>
  );
}
