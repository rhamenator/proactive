'use client';

import { useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Select } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type { TurfListItem } from '../../src/lib/types';

export default function ExportsPage() {
  const api = useAuthedApi();
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [selectedTurfId, setSelectedTurfId] = useState('');
  const [markExported, setMarkExported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void api
      .listTurfs()
      .then(setTurfs)
      .catch((value) => setError(getErrorMessage(value)));
  }, [api]);

  async function handleExport() {
    setDownloading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await api.exportVanResults({
        turfId: selectedTurfId || undefined,
        markExported
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`CSV downloaded as ${result.filename}.`);
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
            <h1>Generate a VAN-ready visit export.</h1>
            <p className="hero-copy">
              Pull all unexported visit logs or narrow the file to a single turf before handing the CSV back
              into downstream processing.
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
            <Button onClick={() => void handleExport()} disabled={downloading}>
              {downloading ? 'Preparing CSV...' : 'Download VAN Results CSV'}
            </Button>
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
