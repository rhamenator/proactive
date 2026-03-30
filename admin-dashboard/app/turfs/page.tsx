'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input, TextArea } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { CanvasserRecord, CsvProfileRecord, ImportBatchRecord, TeamRecord, TurfListItem } from '../../src/lib/types';

const mappingFields = [
  ['vanId', 'VAN ID'],
  ['vanPersonId', 'VAN Person ID'],
  ['vanHouseholdId', 'VAN Household ID'],
  ['addressLine1', 'Address'],
  ['addressLine2', 'Address Line 2'],
  ['unit', 'Unit / Apartment'],
  ['city', 'City'],
  ['state', 'State'],
  ['zip', 'ZIP'],
  ['latitude', 'Latitude'],
  ['longitude', 'Longitude'],
  ['turfName', 'Turf Name']
] as const;

export default function TurfsPage() {
  const { user, runSensitiveAction } = useAuth();
  const api = useAuthedApi();
  const isAdmin = user?.role === 'admin';
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [canvassers, setCanvassers] = useState<CanvasserRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [importHistory, setImportHistory] = useState<ImportBatchRecord[]>([]);
  const [importProfiles, setImportProfiles] = useState<CsvProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTurfName, setNewTurfName] = useState('');
  const [newTurfDescription, setNewTurfDescription] = useState('');
  const [newTurfTeamId, setNewTurfTeamId] = useState('');
  const [newTurfRegionCode, setNewTurfRegionCode] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fallbackTurfName, setFallbackTurfName] = useState('');
  const [importTeamId, setImportTeamId] = useState('');
  const [importRegionCode, setImportRegionCode] = useState('');
  const [importProfileCode, setImportProfileCode] = useState('');
  const [importMode, setImportMode] = useState<'create_only' | 'upsert' | 'replace_turf_membership'>('replace_turf_membership');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'error' | 'merge' | 'review'>('skip');

  const [assignmentSelection, setAssignmentSelection] = useState<Record<string, string>>({});
  const [scopeSelection, setScopeSelection] = useState<Record<string, { teamId: string; regionCode: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTurfs, nextCanvassers, nextTeams, nextImportHistory, nextImportProfiles] = await Promise.all([
        api.listTurfs(),
        api.listCanvassers(),
        api.listTeams(),
        isAdmin ? api.listImportHistory() : Promise.resolve([]),
        isAdmin ? api.listCsvProfiles('import', user?.campaignId ?? null) : Promise.resolve([])
      ]);
      if (isAdmin) {
        const policy = await api.getOperationalPolicy();
        setImportMode(policy.defaultImportMode);
        setDuplicateStrategy(policy.defaultDuplicateStrategy);
        setImportProfileCode(policy.defaultImportProfileCode ?? nextImportProfiles[0]?.code ?? '');
      }
      setTurfs(nextTurfs);
      setCanvassers(nextCanvassers);
      setTeams(nextTeams);
      setImportHistory(nextImportHistory);
      setImportProfiles(nextImportProfiles);
      setScopeSelection(
        Object.fromEntries(
          nextTurfs.map((turf) => [
            turf.id,
            {
              teamId: turf.teamId ?? '',
              regionCode: turf.regionCode ?? ''
            }
          ])
        )
      );
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api, isAdmin, user?.campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateTurf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await api.createTurf({
        name: newTurfName.trim(),
        description: newTurfDescription.trim() || undefined,
        teamId: newTurfTeamId || null,
        regionCode: newTurfRegionCode.trim() || null
      });
      setNewTurfName('');
      setNewTurfDescription('');
      setNewTurfTeamId('');
      setNewTurfRegionCode('');
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
      if (['vanpersonid', 'van_person_id', 'personid', 'person_id', 'voterid'].includes(normalized)) autoMapping.vanPersonId = header;
      if (['vanhouseholdid', 'van_household_id', 'householdid', 'household_id'].includes(normalized)) autoMapping.vanHouseholdId = header;
      if (['addressline1', 'address1', 'street', 'streetaddress', 'address'].includes(normalized)) autoMapping.addressLine1 = header;
      if (['addressline2', 'address2', 'street2'].includes(normalized)) autoMapping.addressLine2 = header;
      if (['unit', 'apt', 'apartment', 'suite', 'unitnumber'].includes(normalized)) autoMapping.unit = header;
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
        mapping: JSON.stringify(mapping),
        mode: importMode,
        duplicateStrategy,
        teamId: importTeamId || null,
        regionCode: importRegionCode.trim() || null,
        profileCode: importProfileCode || null
      });
      setMessage(
        `Imported ${result.addressesImported} addresses across ${result.turfsCreated} turf(s)` +
        `${result.duplicateRowsMerged ? `, merged ${result.duplicateRowsMerged}` : ''}` +
        `${result.pendingDuplicateReviews ? `, queued ${result.pendingDuplicateReviews} duplicate review${result.pendingDuplicateReviews === 1 ? '' : 's'}` : ''}` +
        `${result.replacedMembershipsRemoved ? `, removed ${result.replacedMembershipsRemoved} prior memberships` : ''}.`
      );
      setSelectedFile(null);
      setHeaders([]);
      setMapping({});
      setFallbackTurfName('');
      setImportTeamId('');
      setImportRegionCode('');
      setImportProfileCode('');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleDownloadImport(batchId: string) {
    setError(null);
    try {
      const result = await api.downloadImportBatch(batchId);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleAssign(turfId: string) {
    const canvasserId = assignmentSelection[turfId];
    if (!canvasserId) {
      setError('Choose a canvasser before reassigning.');
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await runSensitiveAction('reassign a turf', (freshApi) =>
        freshApi.reassignTurf(turfId, canvasserId)
      );
      setMessage('Turf reassigned.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleReopen(turfId: string) {
    setError(null);
    setMessage(null);
    try {
      await runSensitiveAction('reopen a turf', (freshApi) => freshApi.reopenTurf(turfId));
      setMessage('Turf reopened.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleArchive(turfId: string, turfName: string) {
    const reason = window.prompt(
      `Archive ${turfName}? Enter a reason if required by policy:`,
      'Closed after review'
    );

    if (reason === null) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await runSensitiveAction('archive a turf', (freshApi) => freshApi.archiveTurf(turfId, reason || undefined));
      setMessage('Turf archived.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function handleDelete(turfId: string, turfName: string) {
    const reason = window.prompt(
      `Soft-delete ${turfName}. Enter a reason:`,
      'Superseded or created in error'
    );

    if (reason === null) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await runSensitiveAction('delete a turf', (freshApi) => freshApi.deleteTurf(turfId, reason));
      setMessage('Turf deleted.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  const headerOptions = useMemo(() => headers.map((header) => <option key={header} value={header}>{header}</option>), [headers]);
  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );
  const teamOptions = useMemo(
    () =>
      teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
          {team.code ? ` (${team.code})` : ''}
          {team.regionCode ? ` • ${team.regionCode}` : ''}
        </option>
      )),
    [teams]
  );
  const importProfileOptions = useMemo(
    () =>
      importProfiles.map((profile) => (
        <option key={`${profile.direction}:${profile.code}:${profile.campaignId ?? 'org'}`} value={profile.code}>
          {profile.name}
          {profile.code ? ` (${profile.code})` : ''}
          {profile.campaignId ? ` • ${profile.campaignId}` : ''}
          {profile.isActive ? '' : ' (inactive)'}
        </option>
      )),
    [importProfiles]
  );

  return (
    <ProtectedFrame title="Turfs And Imports" eyebrow="Core Admin Workflow">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <div className="split">
          {isAdmin ? (
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

              <div className="split">
                <div className="field-group">
                  <label htmlFor="turf-team">Team scope</label>
                  <select
                    id="turf-team"
                    className="select"
                    value={newTurfTeamId}
                    onChange={(event) => {
                      const nextTeamId = event.target.value;
                      setNewTurfTeamId(nextTeamId);
                      setNewTurfRegionCode(teamById.get(nextTeamId)?.regionCode ?? '');
                    }}
                  >
                    <option value="">All teams</option>
                    {teamOptions}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="turf-region">Region code</label>
                  <Input
                    id="turf-region"
                    value={newTurfRegionCode}
                    onChange={(event) => setNewTurfRegionCode(event.target.value)}
                    placeholder="e.g. NORTH"
                  />
                </div>
              </div>

              <Button type="submit">Create Turf</Button>
            </form>
          </Card>
          ) : (
            <Card>
              <div className="stack">
                <div>
                  <p className="section-kicker">Read-only</p>
                  <h2 className="heading-reset">Supervisor turf controls</h2>
                </div>
                <p className="muted">
                  Supervisors can review, reassign, and reopen turf work below. Turf creation and CSV import remain admin-only.
                </p>
              </div>
            </Card>
          )}

          {isAdmin ? (
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

              <div className="split">
                <div className="field-group">
                  <label htmlFor="import-team">Team scope</label>
                  <select
                    id="import-team"
                    className="select"
                    value={importTeamId}
                    onChange={(event) => {
                      const nextTeamId = event.target.value;
                      setImportTeamId(nextTeamId);
                      setImportRegionCode(teamById.get(nextTeamId)?.regionCode ?? '');
                    }}
                  >
                    <option value="">All teams</option>
                    {teamOptions}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="import-region">Region code</label>
                  <Input
                    id="import-region"
                    value={importRegionCode}
                    onChange={(event) => setImportRegionCode(event.target.value)}
                    placeholder="Defaults from selected team"
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="import-profile">CSV profile</label>
                <select
                  id="import-profile"
                  className="select"
                  value={importProfileCode}
                  onChange={(event) => setImportProfileCode(event.target.value)}
                >
                  {importProfileCode && !importProfiles.some((profile) => profile.code === importProfileCode) ? (
                    <option value={importProfileCode}>Policy default: {importProfileCode}</option>
                  ) : null}
                  <option value="">No profile override</option>
                  {importProfileOptions}
                </select>
                <p className="muted">
                  Uses the current scope&apos;s import profiles. The policy default is {importProfileCode || 'not set'}.
                </p>
              </div>

              <div className="grid two">
                <div className="field-group">
                  <label htmlFor="import-mode">Import mode</label>
                  <select
                    id="import-mode"
                    className="select"
                    value={importMode}
                    onChange={(event) => setImportMode(event.target.value as typeof importMode)}
                  >
                    <option value="replace_turf_membership">Replace turf membership only</option>
                    <option value="upsert">Upsert existing turf</option>
                    <option value="create_only">Create new only</option>
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="duplicate-strategy">Duplicate strategy</label>
                  <select
                    id="duplicate-strategy"
                    className="select"
                    value={duplicateStrategy}
                    onChange={(event) => setDuplicateStrategy(event.target.value as typeof duplicateStrategy)}
                  >
                    <option value="skip">Skip duplicate household</option>
                    <option value="merge">Merge duplicate household</option>
                    <option value="review">Queue duplicate for review</option>
                    <option value="error">Stop on duplicate household</option>
                  </select>
                </div>
              </div>

              {headers.length ? (
                <div className="grid two">
                  {mappingFields.map(([field, label]) => (
                    <div className="field-group" key={field}>
                      <label id={`map-${field}-label`} htmlFor={`map-${field}`}>
                        {label}
                      </label>
                      <select
                        title="CSV column mapping"
                        className="select"
                        id={`map-${field}`}
                        aria-labelledby={`map-${field}-label`}
                        aria-label={label}
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
                      </select>
                    </div>
                  ))}
                </div>
              ) : null}

              <Button type="submit" disabled={!selectedFile}>
                Import CSV
              </Button>
            </form>
          </Card>
          ) : null}
        </div>

        {isAdmin ? (
          <Card>
            <div className="stack">
              <div>
                <p className="section-kicker">Import History</p>
                <h2 className="heading-reset">Recent CSV batches</h2>
                <p className="muted">Review recent imports and download the original source CSV for audit or replay.</p>
              </div>

              {!importHistory.length ? (
                <p className="muted">No CSV imports have been recorded yet.</p>
              ) : (
                <div className="stack-tight">
                  {importHistory.map((batch) => (
                    <div className="inline-actions inline-actions-between card-subtle import-history-item" key={batch.id}>
                      <div className="stack-tight">
                        <strong>{batch.filename}</strong>
                        <p className="muted margin-bottom-reset">
                          {batch.importedCount} imported, {batch.mergedCount} merged, {batch.pendingReviewCount ?? 0} pending review, {batch.removedCount ?? 0} removed, {batch.invalidCount} invalid, {batch.duplicateSkippedCount} skipped
                        </p>
                        <p className="muted margin-bottom-reset">
                          {new Date(batch.createdAt).toLocaleString()} • {batch.mode} • {batch.duplicateStrategy}
                        </p>
                        {(batch.teamId || batch.regionCode) ? (
                          <p className="muted margin-bottom-reset">
                            Scope: {batch.teamId ? teamById.get(batch.teamId)?.name ?? batch.teamId : 'All teams'}
                            {batch.regionCode ? ` • ${batch.regionCode}` : ''}
                          </p>
                        ) : null}
                        {batch.artifactPurgedAt ? (
                          <p className="muted margin-bottom-reset">
                            Source artifact purged {new Date(batch.artifactPurgedAt).toLocaleString()} by retention policy.
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleDownloadImport(batch.id)}
                        disabled={Boolean(batch.artifactPurgedAt)}
                      >
                        {batch.artifactPurgedAt ? 'Source Purged' : 'Download Source'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ) : null}

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
                      <div className="muted">
                        Team scope: {teamById.get(turf.teamId ?? '')?.name ?? (turf.teamId ?? 'All teams')}
                        {turf.regionCode ? ` • ${turf.regionCode}` : ''}
                      </div>
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
                      <div className="stack">
                        <div className="inline-actions">
                          <label className="sr-only" id={`scope-team-${turf.id}-label`} htmlFor={`scope-team-${turf.id}`}>
                            Team scope for {turf.name}
                          </label>
                          <select
                            title="Team scope"
                            className="select"
                            id={`scope-team-${turf.id}`}
                            aria-labelledby={`scope-team-${turf.id}-label`}
                            aria-label={`Team scope for ${turf.name}`}
                            value={scopeSelection[turf.id]?.teamId ?? ''}
                            onChange={(event) => {
                              const nextTeamId = event.target.value;
                              setScopeSelection((current) => ({
                                ...current,
                                [turf.id]: {
                                  teamId: nextTeamId,
                                  regionCode: teamById.get(nextTeamId)?.regionCode ?? current[turf.id]?.regionCode ?? ''
                                }
                              }));
                            }}
                            disabled={turf.lifecycleStatus === 'closed'}
                          >
                            <option value="">All teams</option>
                            {teamOptions}
                          </select>
                          <Input
                            id={`scope-region-${turf.id}`}
                            value={scopeSelection[turf.id]?.regionCode ?? ''}
                            onChange={(event) =>
                              setScopeSelection((current) => ({
                                ...current,
                                [turf.id]: {
                                  teamId: current[turf.id]?.teamId ?? '',
                                  regionCode: event.target.value
                                }
                              }))
                            }
                            placeholder="Region code"
                            disabled={turf.lifecycleStatus === 'closed'}
                          />
                          <Button
                            variant="secondary"
                            onClick={() =>
                              void (async () => {
                                const currentScope = scopeSelection[turf.id] ?? { teamId: '', regionCode: '' };
                                setError(null);
                                setMessage(null);
                                try {
                                  await runSensitiveAction('update a turf scope', (freshApi) =>
                                    freshApi.updateTurfScope(turf.id, {
                                      teamId: currentScope.teamId || null,
                                      regionCode: currentScope.regionCode.trim() || null
                                    })
                                  );
                                  setMessage('Turf scope updated.');
                                  await load();
                                } catch (value) {
                                  setError(getErrorMessage(value));
                                }
                              })()
                            }
                            disabled={turf.lifecycleStatus === 'closed'}
                          >
                            Save Scope
                          </Button>
                        </div>
                        <div className="inline-actions">
                          <label className="sr-only" id={`assign-canvasser-${turf.id}-label`} htmlFor={`assign-canvasser-${turf.id}`}>
                            Assign canvasser for {turf.name}
                          </label>
                          <select
                            title="Assign canvasser"
                            className="select"
                            id={`assign-canvasser-${turf.id}`}
                            aria-labelledby={`assign-canvasser-${turf.id}-label`}
                            aria-label={`Assign canvasser for ${turf.name}`}
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
                          </select>
                          <Button variant="secondary" onClick={() => void handleAssign(turf.id)}>
                            Reassign
                          </Button>
                        </div>
                        {(turf.lifecycleStatus === 'completed' || turf.lifecycleStatus === 'closed' || (!turf.lifecycleStatus && (turf.activeSessionCount ?? 0) === 0 && (turf._count?.assignments ?? 0) > 0)) ? (
                          <div className="inline-actions">
                            <Button variant="ghost" onClick={() => void handleReopen(turf.id)}>
                              Reopen
                            </Button>
                            {isAdmin ? (
                              <>
                                <Button variant="ghost" onClick={() => void handleArchive(turf.id, turf.name)}>
                                  Archive
                                </Button>
                                <Button variant="danger" onClick={() => void handleDelete(turf.id, turf.name)}>
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        {isAdmin && turf.lifecycleStatus !== 'closed' ? (
                          <div className="inline-actions">
                            <Button variant="ghost" onClick={() => void handleArchive(turf.id, turf.name)}>
                              Archive
                            </Button>
                            <Button variant="danger" onClick={() => void handleDelete(turf.id, turf.name)}>
                              Delete
                            </Button>
                          </div>
                        ) : null}
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
