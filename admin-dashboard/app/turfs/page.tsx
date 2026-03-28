'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input, Select, TextArea } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type { CanvasserRecord, TurfListItem } from '../../src/lib/types';

const mappingFields = [
  ['vanId', 'VAN ID'],
  ['addressLine1', 'Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['zip', 'ZIP'],
  ['latitude', 'Latitude'],
  ['longitude', 'Longitude'],
  ['turfName', 'Turf Name']
] as const;

export default function TurfsPage() {
  const api = useAuthedApi();
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [canvassers, setCanvassers] = useState<CanvasserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTurfName, setNewTurfName] = useState('');
  const [newTurfDescription, setNewTurfDescription] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fallbackTurfName, setFallbackTurfName] = useState('');

  const [assignmentSelection, setAssignmentSelection] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextTurfs, nextCanvassers] = await Promise.all([api.listTurfs(), api.listCanvassers()]);
      setTurfs(nextTurfs);
      setCanvassers(nextCanvassers);
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreateTurf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await api.createTurf({
        name: newTurfName.trim(),
        description: newTurfDescription.trim() || undefined
      });
      setNewTurfName('');
      setNewTurfDescription('');
      setMessage('Turf created.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setHeaders([]);
    setMapping({});

    if (!file) {
      return;
    }

    const text = await file.text();
    const firstRow = text.split(/\r?\n/, 1)[0] ?? '';
    const nextHeaders = firstRow.split(',').map((item) => item.trim()).filter(Boolean);
    setHeaders(nextHeaders);

    const autoMapping: Record<string, string> = {};
    for (const header of nextHeaders) {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (normalized === 'vanid' || normalized === 'van_id') autoMapping.vanId = header;
      if (['addressline1', 'address1', 'street', 'streetaddress', 'address'].includes(normalized)) autoMapping.addressLine1 = header;
      if (normalized === 'city') autoMapping.city = header;
      if (normalized === 'state') autoMapping.state = header;
      if (normalized === 'zip' || normalized === 'zipcode') autoMapping.zip = header;
      if (normalized === 'latitude' || normalized === 'lat') autoMapping.latitude = header;
      if (normalized === 'longitude' || normalized === 'lng' || normalized === 'lon') autoMapping.longitude = header;
      if (normalized === 'turfname' || normalized === 'turf' || normalized === 'district') autoMapping.turfName = header;
    }
    setMapping(autoMapping);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError('Choose a CSV file to import.');
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const result = await api.importTurfs({
        file: selectedFile,
        turfName: fallbackTurfName.trim() || undefined,
        mapping: JSON.stringify(mapping)
      });
      setMessage(`Imported ${result.addressesImported} addresses across ${result.turfsCreated} turf(s).`);
      setSelectedFile(null);
      setHeaders([]);
      setMapping({});
      setFallbackTurfName('');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleAssign(turfId: string) {
    const canvasserId = assignmentSelection[turfId];
    if (!canvasserId) {
      setError('Choose a canvasser before assigning.');
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await api.assignTurf(turfId, canvasserId);
      setMessage('Turf assigned.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  const headerOptions = useMemo(() => headers.map((header) => <option key={header} value={header}>{header}</option>), [headers]);

  return (
    <ProtectedFrame title="Turfs And Imports" eyebrow="Core Admin Workflow">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="split">
          <Card>
            <form className="stack" onSubmit={handleCreateTurf}>
              <div>
                <p className="section-kicker">Create Turf</p>
                <h2 className="heading-reset">Manual turf entry</h2>
              </div>

              <div className="field-group">
                <label htmlFor="turf-name">Turf name</label>
                <Input id="turf-name" value={newTurfName} onChange={(event) => setNewTurfName(event.target.value)} required />
              </div>

              <div className="field-group">
                <label htmlFor="turf-description">Description</label>
                <TextArea id="turf-description" value={newTurfDescription} onChange={(event) => setNewTurfDescription(event.target.value)} />
              </div>

              <Button type="submit">Create Turf</Button>
            </form>
          </Card>

          <Card>
            <form className="stack" onSubmit={handleImport}>
              <div>
                <p className="section-kicker">CSV Import</p>
                <h2 className="heading-reset">VAN-ready list upload</h2>
                <p className="muted">Upload a CSV, confirm the headers, and create grouped turf records.</p>
              </div>

              <div className="field-group">
                <label htmlFor="csv-file">CSV file</label>
                <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
              </div>

              <div className="field-group">
                <label htmlFor="fallback-turf">Fallback turf name</label>
                <Input id="fallback-turf" value={fallbackTurfName} onChange={(event) => setFallbackTurfName(event.target.value)} placeholder="Used if the CSV has no turf_name column" />
              </div>

              {headers.length ? (
                <div className="grid two">
                  {mappingFields.map(([field, label]) => (
                    <div className="field-group" key={field}>
                      <label htmlFor={`map-${field}`}>{label}</label>
                      <Select
                        id={`map-${field}`}
                        aria-label={label}
                        title={label}
                        value={mapping[field] ?? ''}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field]: event.target.value
                          }))
                        }
                      >
                        <option value="">Not mapped</option>
                        {headerOptions}
                      </Select>
                    </div>
                  ))}
                </div>
              ) : null}

              <Button type="submit" disabled={!selectedFile}>
                Import CSV
              </Button>
            </form>
          </Card>
        </div>

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Current Turfs</p>
              <h2 className="heading-reset">Assignment board</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Turf</th>
                  <th>Addresses</th>
                  <th>Assignments</th>
                  <th>Sessions</th>
                  <th>Visits</th>
                  <th>Assign</th>
                </tr>
              </thead>
              <tbody>
                {turfs.map((turf) => (
                  <tr key={turf.id}>
                    <td>
                      <strong>{turf.name}</strong>
                      <div className="muted">{turf.description || 'No description'}</div>
                    </td>
                    <td>{turf._count?.addresses ?? 0}</td>
                    <td>{turf._count?.assignments ?? 0}</td>
                    <td>
                      <Badge tone={(turf.activeSessionCount ?? 0) > 0 ? 'success' : 'default'}>
                        {turf.activeSessionCount ?? 0} active
                      </Badge>
                    </td>
                    <td>{turf._count?.visits ?? 0}</td>
                    <td>
                      <div className="inline-actions">
                        <label className="sr-only" htmlFor={`assign-canvasser-${turf.id}`}>
                          Assign canvasser for {turf.name}
                        </label>
                        <Select
                          id={`assign-canvasser-${turf.id}`}
                          aria-label={`Assign canvasser for ${turf.name}`}
                          title={`Assign canvasser for ${turf.name}`}
                          value={assignmentSelection[turf.id] ?? ''}
                          onChange={(event) =>
                            setAssignmentSelection((current) => ({
                              ...current,
                              [turf.id]: event.target.value
                            }))
                          }
                        >
                          <option value="">Choose canvasser</option>
                          {canvassers.map((canvasser) => (
                            <option key={canvasser.id} value={canvasser.id}>
                              {canvasser.firstName} {canvasser.lastName}
                            </option>
                          ))}
                        </Select>
                        <Button variant="secondary" onClick={() => void handleAssign(turf.id)}>
                          Assign
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!turfs.length ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state muted">No turfs yet. Create one manually or import a CSV.</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
