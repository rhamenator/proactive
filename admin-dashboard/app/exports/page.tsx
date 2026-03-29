'use client';

import { useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Select } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { ExportBatchRecord, TurfListItem } from '../../src/lib/types';

export default function ExportsPage() {
  const { user } = useAuth();
  const api = useAuthedApi();
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [history, setHistory] = useState<ExportBatchRecord[]>([]);
  const [selectedTurfId, setSelectedTurfId] = useState('');
  const [markExported, setMarkExported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    void api
      .listTurfs()
      .then(setTurfs)
      .catch((value) => setError(getErrorMessage(value)));
    void api
      .listExportHistory()
      .then(setHistory)
      .catch((value) => setError(getErrorMessage(value)));
  }, [api, user?.role]);

  if (user?.role !== 'admin') {
    return (
      <ProtectedFrame title="Exports" eyebrow="Restricted">
        <Card className="stack">
          <p className="section-kicker">Admin Only</p>
          <h2 className="heading-reset">Export access is restricted</h2>
          <p className="muted">
            Supervisors can review dashboard, turf, GPS, and outcome data, but only admins can generate exports.
          </p>
        </Card>
      </ProtectedFrame>
    );
  }

  async function handleExport(profile: 'van' | 'internal') {
    setDownloading(true);
    setError(null);
    setMessage(null);

    try {
      const result =
        profile === 'van'
          ? await api.exportVanResults({
              turfId: selectedTurfId || undefined,
              markExported
            })
          : await api.exportInternalMaster({
              turfId: selectedTurfId || undefined
            });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`CSV downloaded as ${result.filename}.`);
      const latestHistory = await api.listExportHistory();
      setHistory(latestHistory);
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <ProtectedFrame title="Exports" eyebrow="VAN Workflow">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="hero-panel">
          <div>
            <p className="section-kicker">Download Results</p>
            <h1>Generate export files for operations and downstream upload.</h1>
            <p className="hero-copy">
              Pull either the internal master export for operational review or the VAN-compatible export for
              downstream handoff, optionally narrowed to a single turf.
            </p>
          </div>
          <div className="hero-aside">
            <Badge tone="gold">CSV release path</Badge>
            <span className="muted">This release intentionally avoids live VAN API coupling.</span>
          </div>
        </Card>

        <Card className="stack">
          <div className="field-group">
            <label htmlFor="turf-filter">Filter by turf</label>
            <Select id="turf-filter" value={selectedTurfId} onChange={(event) => setSelectedTurfId(event.target.value)}>
              <option value="">All turfs</option>
              {turfs.map((turf) => (
                <option key={turf.id} value={turf.id}>
                  {turf.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="inline-actions">
            <Button variant={markExported ? 'secondary' : 'ghost'} onClick={() => setMarkExported((current) => !current)}>
              {markExported ? 'Mark rows exported: ON' : 'Mark rows exported: OFF'}
            </Button>
            <Button variant="secondary" onClick={() => void handleExport('internal')} disabled={downloading}>
              {downloading ? 'Preparing CSV...' : 'Download Internal Master CSV'}
            </Button>
            <Button onClick={() => void handleExport('van')} disabled={downloading}>
              {downloading ? 'Preparing CSV...' : 'Download VAN Results CSV'}
            </Button>
          </div>
        </Card>

        <Card className="stack">
          <div>
            <p className="section-kicker">Export History</p>
            <h2 className="heading-reset">Recent export batches</h2>
            <p className="muted">Each export records the profile, file name, row count, turf scope, and initiating user.</p>
          </div>

          {history.length === 0 ? (
            <p className="muted">No export batches have been recorded yet.</p>
          ) : (
            <div className="stack">
              {history.map((batch) => (
                <Card key={batch.id} className="stack">
                  <div className="inline-actions">
                    <strong>{batch.filename}</strong>
                    <Badge tone={batch.profileCode === 'internal_master' ? 'default' : 'gold'}>
                      {batch.profileCode === 'internal_master' ? 'Internal Master' : 'VAN Compatible'}
                    </Badge>
                  </div>
                  <p className="muted">
                    {batch.rowCount} rows
                    {batch.turf?.name ? ` • ${batch.turf.name}` : ' • All turfs'}
                    {batch.markExported ? ' • marked exported' : ' • export flags unchanged'}
                  </p>
                  <p className="muted">
                    {new Date(batch.createdAt).toLocaleString()}
                    {batch.initiatedByUser
                      ? ` • ${batch.initiatedByUser.firstName} ${batch.initiatedByUser.lastName}`.trim()
                      : ''}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </ProtectedFrame>
  );
}
