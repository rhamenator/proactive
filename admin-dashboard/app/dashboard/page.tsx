'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import { formatLocalDateTime } from '../../src/lib/datetime';
import type { DashboardSummary } from '../../src/lib/types';

export default function DashboardPage() {
  const api = useAuthedApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.dashboardSummary());
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
    <ProtectedFrame title="Operations Dashboard" eyebrow="Admin Overview">
      <div className="stack">
        <Card className="hero-panel">
          <div>
            <p className="section-kicker">Today&apos;s field picture</p>
            <h1>Run turfs, monitor crews, and keep exports moving.</h1>
            <p className="hero-copy">
              This release is optimized for CSV-based VAN workflows. Import lists, assign canvassers,
              monitor open sessions, and hand back clean result files.
            </p>
            <div className="inline-actions">
              <Button onClick={() => void load()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh Summary'}
              </Button>
            </div>
          </div>

          <div className="hero-aside">
            <span className="mini-label">Release posture</span>
            <strong>CSV import/export first, live API later</strong>
            <span className="muted">GPS validation active, red reserved for actual alerts only.</span>
          </div>
        </Card>

        {error ? <div className="notice notice-error">{error}</div> : null}

        <section className="grid four">
          <StatCard label="Active Sessions" value={summary?.totals.activeSessions ?? 0} tone="gold" />
          <StatCard label="Visits Logged" value={summary?.totals.visits ?? 0} tone="default" />
          <StatCard label="Addresses Complete" value={summary?.totals.completedAddresses ?? 0} tone="success" />
          <StatCard label="Turfs" value={summary?.totals.turfs ?? 0} tone="default" />
        </section>

        <div className="split">
          <Card className="stack">
            <div>
              <p className="section-kicker">Active Canvassers</p>
              <h2 className="heading-reset">Open turf sessions</h2>
            </div>

            {summary?.activeCanvassers.length ? (
              <div className="stack">
                {summary.activeCanvassers.map((session) => (
                  <div key={session.id} className="card card-subtle">
                    <div className="inline-actions inline-actions-between">
                      <div>
                        <strong>
                          {session.canvasser.firstName} {session.canvasser.lastName}
                        </strong>
                        <div className="muted">{session.canvasser.email}</div>
                      </div>
                      <Badge tone="success">{session.turf.name}</Badge>
                    </div>
                    <p className="muted muted-no-bottom">
                      Started {formatLocalDateTime(session.startTime)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state muted">No active canvassers are currently in an open turf session.</div>
            )}
          </Card>

          <Card className="stack">
            <div>
              <p className="section-kicker">Turf Progress</p>
              <h2 className="heading-reset">Completion by turf</h2>
            </div>

            {summary?.turfs.length ? (
              <div className="stack">
                {summary.turfs.map((turf) => (
                  <div key={turf.id}>
                    <div className="inline-actions inline-actions-between progress-row">
                      <strong>{turf.name}</strong>
                      <Badge tone={turf.progressPercent >= 75 ? 'success' : turf.progressPercent >= 35 ? 'gold' : 'default'}>
                        {turf.progressPercent}% complete
                      </Badge>
                    </div>
                    <div className="muted">
                      {turf.visitCount} visits across {turf.addressCount} addresses
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state muted">Imported turfs will appear here after the first upload.</div>
            )}
          </Card>
        </div>
      </div>
    </ProtectedFrame>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: 'default' | 'gold' | 'success';
}) {
  return (
    <Card className="stat-card">
      <Badge tone={tone}>{label}</Badge>
      <div className="stat-value">{value}</div>
    </Card>
  );
}
