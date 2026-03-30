'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, TextArea } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { SyncConflictItem } from '../../src/lib/types';

export default function SyncConflictsPage() {
  const { runSensitiveAction } = useAuth();
  const api = useAuthedApi();
  const [items, setItems] = useState<SyncConflictItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.syncConflictQueue());
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResolve(event: FormEvent<HTMLFormElement>, visitLogId: string) {
    event.preventDefault();
    const reason = (reasons[visitLogId] ?? '').trim();
    if (!reason) {
      setError('Provide a reason before resolving a sync conflict.');
      return;
    }

    setError(null);
    setMessage(null);
    try {
      setSubmittingId(visitLogId);
      await runSensitiveAction('resolve a sync conflict', (freshApi) =>
        freshApi.resolveSyncConflict(visitLogId, reason)
      );
      setMessage('Sync conflict cleared.');
      setReasons((current) => ({ ...current, [visitLogId]: '' }));
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <ProtectedFrame title="Sync Conflicts" eyebrow="Operations Review">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="inline-actions inline-actions-between">
          <div>
            <p className="section-kicker">Conflict Queue</p>
            <h2 className="heading-reset">Visit submissions flagged for sync review</h2>
          </div>
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Card>

        {items.length ? (
          items.map((item) => (
            <Card key={item.id} className="stack">
              <div className="inline-actions inline-actions-between">
                <div>
                  <strong>{item.address.addressLine1}</strong>
                  <div className="muted">
                    {item.address.city}, {item.address.state}
                    {item.address.zip ? ` ${item.address.zip}` : ''}
                  </div>
                </div>
                <div className="inline-actions">
                  <Badge tone={item.syncConflictFlag ? 'warning' : 'default'}>{item.syncStatus}</Badge>
                  <Badge tone="gold">{item.turf.name}</Badge>
                </div>
              </div>

              <div className="muted">
                Conflict reason: {item.syncConflictReason ?? 'Flagged for manual review'}
              </div>
              <div className="muted">
                Outcome: {item.outcomeLabel ?? item.outcomeCode ?? item.result ?? 'Unknown'}
              </div>
              <div className="muted">
                Source: {item.source.replace('_', ' ')}
              </div>
              <div className="muted">
                Visit time: {new Date(item.visitTime).toLocaleString()}
              </div>
              {item.localRecordUuid ? <div className="muted">Local record UUID: {item.localRecordUuid}</div> : null}
              {item.idempotencyKey ? <div className="muted">Idempotency key: {item.idempotencyKey}</div> : null}
              <div className="muted">
                Canvasser: {item.canvasser.firstName} {item.canvasser.lastName}
              </div>
              {item.notes ? <div className="muted">Notes: {item.notes}</div> : null}

              <form className="stack" onSubmit={(event) => void handleResolve(event, item.id)}>
                <div className="field-group">
                  <label htmlFor={`sync-resolution-${item.id}`}>Resolution reason</label>
                  <TextArea
                    id={`sync-resolution-${item.id}`}
                    value={reasons[item.id] ?? ''}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [item.id]: event.target.value
                      }))
                    }
                    placeholder="Explain why this conflict can be cleared and the record retained"
                    rows={3}
                  />
                </div>
                <div className="inline-actions">
                  <Button type="submit" disabled={submittingId === item.id}>
                    {submittingId === item.id ? 'Resolving...' : 'Resolve Conflict'}
                  </Button>
                </div>
              </form>
            </Card>
          ))
        ) : (
          <Card>
            <div className="empty-state muted">No sync conflicts are currently queued.</div>
          </Card>
        )}
      </div>
    </ProtectedFrame>
  );
}
