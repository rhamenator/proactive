'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { GpsReviewItem } from '../../src/lib/types';

export default function GpsReviewPage() {
  const { runSensitiveAction } = useAuth();
  const api = useAuthedApi();
  const [items, setItems] = useState<GpsReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.gpsReviewQueue());
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleOverride(event: FormEvent<HTMLFormElement>, visitLogId: string) {
    event.preventDefault();
    const reason = (reasons[visitLogId] ?? '').trim();
    if (!reason) {
      setError('Provide an override reason before approving GPS validation.');
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await runSensitiveAction('approve a GPS override', (freshApi) =>
        freshApi.overrideGpsResult(visitLogId, reason)
      );
      setMessage('GPS override saved.');
      setReasons((current) => ({ ...current, [visitLogId]: '' }));
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  return (
    <ProtectedFrame title="GPS Review" eyebrow="Quality Control">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="inline-actions inline-actions-between">
          <div>
            <p className="section-kicker">Review Queue</p>
            <h2 className="heading-reset">Flagged or overridden GPS records</h2>
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
                  <Badge tone={item.overrideFlag ? 'success' : item.gpsStatus === 'flagged' ? 'warning' : 'default'}>
                    {item.overrideFlag ? 'Overridden' : item.gpsStatus}
                  </Badge>
                  <Badge tone="gold">{item.visitLog.turf.name}</Badge>
                </div>
              </div>

              <div className="muted">
                Outcome: {item.visitLog.outcomeLabel ?? item.visitLog.outcomeCode ?? item.visitLog.result ?? 'Unknown'}
              </div>
              <div className="muted">
                Failure reason: {item.failureReason ?? 'None'}
              </div>
              <div className="muted">
                Distance: {item.distanceFromTargetFeet ?? 'n/a'} feet of {item.validationRadiusFeet} allowed
              </div>
              <div className="muted">
                Canvasser: {item.visitLog.canvasser.firstName} {item.visitLog.canvasser.lastName}
              </div>
              {item.visitLog.notes ? <div className="muted">Notes: {item.visitLog.notes}</div> : null}
              {item.overrideFlag ? (
                <div className="notice notice-success">
                  Override saved{item.overrideReason ? `: ${item.overrideReason}` : '.'}
                </div>
              ) : (
                <form className="stack" onSubmit={(event) => void handleOverride(event, item.visitLogId)}>
                  <div className="field-group">
                    <label htmlFor={`override-reason-${item.visitLogId}`}>Override reason</label>
                    <Input
                      id={`override-reason-${item.visitLogId}`}
                      value={reasons[item.visitLogId] ?? ''}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [item.visitLogId]: event.target.value
                        }))
                      }
                      placeholder="Explain why the GPS flag should be overridden"
                    />
                  </div>
                  <div className="inline-actions">
                    <Button type="submit">Approve Override</Button>
                  </div>
                </form>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <div className="empty-state muted">No GPS review items are currently queued.</div>
          </Card>
        )}
      </div>
    </ProtectedFrame>
  );
}
