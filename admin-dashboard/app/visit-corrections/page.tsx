'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Button, Card, Input, Select, TextArea } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type { OutcomeDefinitionRecord, RecentVisitRecord } from '../../src/lib/types';

export default function VisitCorrectionsPage() {
  const api = useAuthedApi();
  const [visits, setVisits] = useState<RecentVisitRecord[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeDefinitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ outcomeCode: '', notes: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recentVisits, outcomeList] = await Promise.all([
        api.listRecentVisits(),
        api.listOutcomeDefinitions()
      ]);
      setVisits(recentVisits);
      setOutcomes(outcomeList);
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function beginEdit(visit: RecentVisitRecord) {
    setEditingId(visit.id);
    setForm({
      outcomeCode: visit.outcomeCode,
      notes: visit.notes ?? '',
      reason: ''
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await api.correctVisit(editingId, {
        outcomeCode: form.outcomeCode,
        notes: form.notes,
        reason: form.reason
      });
      setMessage('Visit correction saved.');
      setEditingId(null);
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedFrame title="Visit Corrections" eyebrow="Review Workflow">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Recent Visits</p>
              <h2 className="heading-reset">Correct an audited visit record</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="stack">
            {visits.map((visit) => (
              <Card key={visit.id} className="stack card-subtle">
                <div className="inline-actions inline-actions-between">
                  <div>
                    <strong>{visit.address.addressLine1}</strong>
                    <div className="muted">
                      {visit.canvasser.firstName} {visit.canvasser.lastName} • {new Date(visit.visitTime).toLocaleString()}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => beginEdit(visit)}>
                    Correct Visit
                  </Button>
                </div>
                <div className="muted">
                  Current outcome: {visit.outcomeLabel}
                  {visit.notes ? ` • ${visit.notes}` : ''}
                </div>
                {editingId === visit.id ? (
                  <form className="stack" onSubmit={submit}>
                    <div className="field-group">
                      <label htmlFor={`outcome-${visit.id}`}>Corrected outcome</label>
                      <Select
                        id={`outcome-${visit.id}`}
                        value={form.outcomeCode}
                        onChange={(event) => setForm((current) => ({ ...current, outcomeCode: event.target.value }))}
                      >
                        {outcomes.map((outcome) => (
                          <option key={outcome.id} value={outcome.code}>{outcome.label}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="field-group">
                      <label htmlFor={`notes-${visit.id}`}>Notes</label>
                      <TextArea
                        id={`notes-${visit.id}`}
                        value={form.notes}
                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor={`reason-${visit.id}`}>Audit reason</label>
                      <Input
                        id={`reason-${visit.id}`}
                        value={form.reason}
                        onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="inline-actions">
                      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Correction'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : null}
              </Card>
            ))}
            {!visits.length ? <div className="empty-state muted">No recent visits are available for review.</div> : null}
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
