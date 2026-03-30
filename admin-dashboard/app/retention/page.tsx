'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Button, Card } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { RetentionSummary } from '../../src/lib/types';

export default function RetentionPage() {
  const api = useAuthedApi();
  const { runSensitiveAction } = useAuth();
  const [summary, setSummary] = useState<RetentionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.retentionSummary());
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCleanup() {
    setError(null);
    setMessage(null);
    try {
      const result = await runSensitiveAction('run retention cleanup', (freshApi) => freshApi.runRetentionCleanup());
      if (result.skipped) {
        setMessage('Retention cleanup was skipped because another run is already in progress.');
      } else {
        setMessage('Retention cleanup completed.');
      }
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  return (
    <ProtectedFrame title="Retention" eyebrow="Lifecycle Operations">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Retention Summary</p>
              <h2 className="heading-reset">Due artifacts and expired credentials</h2>
            </div>
            <div className="inline-actions">
              <Button variant="ghost" onClick={() => void load()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button onClick={() => void runCleanup()} disabled={loading}>
                Run Cleanup
              </Button>
            </div>
          </div>

          {summary ? (
            <>
              <div className="muted">
                Automation: {summary.automation.enabled ? `enabled every ${summary.automation.intervalMinutes} minutes` : 'disabled'}
                {summary.lastRunAt ? ` • Last run ${new Date(summary.lastRunAt).toLocaleString()}` : ' • No completed cleanup logged yet'}
              </div>
              <div className="grid two">
                {Object.entries(summary.dueNow).map(([key, count]) => (
                  <Card key={key} className="card-subtle stack-tight">
                    <span className="section-kicker">{key}</span>
                    <strong>{count}</strong>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state muted">No retention summary available yet.</div>
          )}
        </Card>
      </div>
    </ProtectedFrame>
  );
}
