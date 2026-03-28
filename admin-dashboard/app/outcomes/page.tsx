'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { OutcomeDefinitionRecord } from '../../src/lib/types';

type OutcomeForm = {
  code: string;
  label: string;
  requiresNote: boolean;
  isFinalDisposition: boolean;
  displayOrder: number;
  isActive: boolean;
};

const emptyForm: OutcomeForm = {
  code: '',
  label: '',
  requiresNote: false,
  isFinalDisposition: true,
  displayOrder: 0,
  isActive: true
};

export default function OutcomesPage() {
  const { user } = useAuth();
  const api = useAuthedApi();
  const [outcomes, setOutcomes] = useState<OutcomeDefinitionRecord[]>([]);
  const [form, setForm] = useState<OutcomeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOutcomes(await api.listOutcomeDefinitions());
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      if (editingId) {
        await api.updateOutcomeDefinition(editingId, form);
        setMessage('Outcome updated.');
      } else {
        await api.createOutcomeDefinition(form);
        setMessage('Outcome created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  function beginEdit(outcome: OutcomeDefinitionRecord) {
    setEditingId(outcome.id);
    setForm({
      code: outcome.code,
      label: outcome.label,
      requiresNote: outcome.requiresNote,
      isFinalDisposition: outcome.isFinalDisposition,
      displayOrder: outcome.displayOrder,
      isActive: outcome.isActive
    });
  }

  return (
    <ProtectedFrame title="Outcomes" eyebrow="Visit Configuration">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="split">
          <Card>
            {isAdmin ? (
              <form className="stack" onSubmit={handleSubmit}>
                <div>
                  <p className="section-kicker">{editingId ? 'Edit Outcome' : 'Create Outcome'}</p>
                  <h2 className="heading-reset">Configurable canvassing results</h2>
                </div>

                <div className="field-group">
                  <label htmlFor="outcome-code">Code</label>
                  <Input
                    id="outcome-code"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    required
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="outcome-label">Label</label>
                  <Input
                    id="outcome-label"
                    value={form.label}
                    onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                    required
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="outcome-order">Display order</label>
                  <Input
                    id="outcome-order"
                    type="number"
                    value={String(form.displayOrder)}
                    onChange={(event) => setForm((current) => ({ ...current, displayOrder: Number(event.target.value || 0) }))}
                  />
                </div>

                <div className="inline-actions">
                  <Button
                    variant={form.requiresNote ? 'secondary' : 'ghost'}
                    onClick={() => setForm((current) => ({ ...current, requiresNote: !current.requiresNote }))}
                  >
                    {form.requiresNote ? 'Requires Note: ON' : 'Requires Note: OFF'}
                  </Button>
                  <Button
                    variant={form.isFinalDisposition ? 'secondary' : 'ghost'}
                    onClick={() => setForm((current) => ({ ...current, isFinalDisposition: !current.isFinalDisposition }))}
                  >
                    {form.isFinalDisposition ? 'Final: ON' : 'Final: OFF'}
                  </Button>
                  <Button
                    variant={form.isActive ? 'secondary' : 'ghost'}
                    onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                  >
                    {form.isActive ? 'Active: ON' : 'Active: OFF'}
                  </Button>
                </div>

                <div className="inline-actions">
                  <Button type="submit">{editingId ? 'Save Outcome' : 'Create Outcome'}</Button>
                  {editingId ? (
                    <Button variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                      Cancel Edit
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="stack">
                <div>
                  <p className="section-kicker">Read-only</p>
                  <h2 className="heading-reset">Supervisor outcome view</h2>
                </div>
                <p className="muted">Supervisors can review current outcome definitions, but only admins can change them.</p>
              </div>
            )}
          </Card>

          <Card className="stack">
            <div className="inline-actions inline-actions-between">
              <div>
                <p className="section-kicker">Current Outcomes</p>
                <h2 className="heading-reset">Submission options</h2>
              </div>
              <Button variant="ghost" onClick={() => void load()} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            <div className="stack">
              {outcomes.map((outcome) => (
                <Card key={outcome.id} className="stack card-subtle">
                  <div className="inline-actions inline-actions-between">
                    <div>
                      <strong>{outcome.label}</strong>
                      <div className="muted">{outcome.code}</div>
                    </div>
                    <div className="inline-actions">
                      <Badge tone={outcome.isActive ? 'success' : 'warning'}>
                        {outcome.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge tone="default">Order {outcome.displayOrder}</Badge>
                    </div>
                  </div>
                  <div className="muted">
                    {outcome.requiresNote ? 'Requires notes.' : 'Notes optional.'} {outcome.isFinalDisposition ? 'Counts as final disposition.' : 'Not final.'}
                  </div>
                  {isAdmin ? (
                    <div className="inline-actions">
                      <Button variant="secondary" onClick={() => beginEdit(outcome)}>
                        Edit
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
              {!outcomes.length ? <div className="empty-state muted">No outcome definitions found.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </ProtectedFrame>
  );
}
