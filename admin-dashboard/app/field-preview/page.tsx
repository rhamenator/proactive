'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi, useAuth } from '../../src/lib/auth-context';

type Snapshot = {
  turf: { id: string; name: string; description?: string | null } | null;
  session: { id: string; startTime: string; endTime?: string | null; status?: string } | null;
  progress: { completed: number; total: number; pendingSync: number };
  addresses: Array<{
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
    lastResult?: string | null;
    lastVisitAt?: string | null;
  }>;
};

export default function FieldPreviewPage() {
  const { user } = useAuth();
  const api = useAuthedApi();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await api.myTurfSnapshot());
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProtectedFrame title="Field Preview" eyebrow="Impersonated Canvasser View">
      <div className="stack">
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Impersonated Session</p>
              <h2 className="heading-reset">Canvasser field snapshot</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="inline-actions">
            <Badge tone="default">{user?.role}</Badge>
            <Badge tone={snapshot?.session ? 'success' : 'gold'}>
              {snapshot?.session ? 'Active field context' : 'No active session'}
            </Badge>
          </div>

          <div className="muted">
            Turf: {snapshot?.turf?.name ?? 'No turf assigned'}
            {snapshot?.turf?.description ? ` • ${snapshot.turf.description}` : ''}
          </div>
          <div className="muted">
            Progress: {snapshot?.progress.completed ?? 0}/{snapshot?.progress.total ?? 0} completed • {snapshot?.progress.pendingSync ?? 0} pending sync
          </div>
        </Card>

        <Card className="stack">
          <div>
            <p className="section-kicker">Addresses</p>
            <h2 className="heading-reset">Current field list</h2>
          </div>
          <div className="stack">
            {snapshot?.addresses.map((address) => (
              <Card key={address.id} className="stack card-subtle">
                <strong>{address.addressLine1}</strong>
                <div className="muted">
                  {address.city}, {address.state}
                  {address.zip ? ` ${address.zip}` : ''}
                </div>
                <div className="muted">
                  {address.lastResult ? `Last result: ${address.lastResult}` : 'No visit logged yet'}
                </div>
              </Card>
            ))}
            {!snapshot?.addresses.length ? <div className="empty-state muted">No addresses are currently assigned.</div> : null}
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
