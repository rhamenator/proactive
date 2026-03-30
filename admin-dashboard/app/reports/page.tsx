'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type {
  AuditActivityItem,
  FieldUserRecord,
  GpsExceptionRow,
  ProductivityRow,
  ReportFilters,
  ReportOverview,
  TurfListItem
} from '../../src/lib/types';

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  if (!rows.length) {
    return;
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  const escapeValue = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const api = useAuthedApi();
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [productivity, setProductivity] = useState<ProductivityRow[]>([]);
  const [gpsExceptions, setGpsExceptions] = useState<GpsExceptionRow[]>([]);
  const [auditActivity, setAuditActivity] = useState<AuditActivityItem[]>([]);
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [canvassers, setCanvassers] = useState<FieldUserRecord[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: '',
    dateTo: '',
    turfId: '',
    canvasserId: '',
    syncStatus: undefined,
    gpsStatus: undefined
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedFilters = useMemo<ReportFilters>(() => ({
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    turfId: filters.turfId || undefined,
    canvasserId: filters.canvasserId || undefined,
    syncStatus: filters.syncStatus || undefined,
    gpsStatus: filters.gpsStatus || undefined
  }), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResult, productivityResult, gpsResult, auditResult, turfResult, canvasserResult] = await Promise.all([
        api.reportsOverview(normalizedFilters),
        api.reportsProductivity(normalizedFilters),
        api.reportsGpsExceptions(normalizedFilters),
        api.reportsAuditActivity(normalizedFilters),
        api.listTurfs(),
        api.listCanvassers()
      ]);
      setOverview(overviewResult);
      setProductivity(productivityResult.rows);
      setGpsExceptions(gpsResult.rows);
      setAuditActivity(auditResult.rows);
      setTurfs(turfResult);
      setCanvassers(canvasserResult);
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api, normalizedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProtectedFrame title="Reports" eyebrow="Analytics">
      <div className="stack">
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Filters</p>
              <h2 className="heading-reset">Slice operational reporting</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="grid two">
            <div className="field-group">
              <label htmlFor="date-from">Date from</label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="date-to">Date to</label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="turf-filter">Turf</label>
              <select
                id="turf-filter"
                className="select"
                value={filters.turfId ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, turfId: event.target.value }))}
              >
                <option value="">All turfs</option>
                {turfs.map((turf) => (
                  <option key={turf.id} value={turf.id}>{turf.name}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="canvasser-filter">Canvasser</label>
              <select
                id="canvasser-filter"
                className="select"
                value={filters.canvasserId ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, canvasserId: event.target.value }))}
              >
                <option value="">All field users</option>
                {canvassers.map((canvasser) => (
                  <option key={canvasser.id} value={canvasser.id}>
                    {canvasser.firstName} {canvasser.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="sync-status-filter">Sync status</label>
              <select
                id="sync-status-filter"
                className="select"
                value={filters.syncStatus ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    syncStatus: event.target.value ? (event.target.value as ReportFilters['syncStatus']) : undefined
                  }))
                }
              >
                <option value="">All sync states</option>
                <option value="pending">Pending</option>
                <option value="syncing">Syncing</option>
                <option value="synced">Synced</option>
                <option value="failed">Failed</option>
                <option value="conflict">Conflict</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="gps-status-filter">GPS status</label>
              <select
                id="gps-status-filter"
                className="select"
                value={filters.gpsStatus ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    gpsStatus: event.target.value ? (event.target.value as ReportFilters['gpsStatus']) : undefined
                  }))
                }
              >
                <option value="">All GPS states</option>
                <option value="verified">Verified</option>
                <option value="flagged">Flagged</option>
                <option value="missing">Missing</option>
                <option value="low_accuracy">Low accuracy</option>
              </select>
            </div>
          </div>
        </Card>

        <section className="grid four">
          <StatCard label="Visits" value={overview?.kpis.totalVisits ?? 0} />
          <StatCard label="Visited Homes" value={overview?.kpis.uniqueAddressesVisited ?? 0} tone="success" />
          <StatCard label="Contacts" value={overview?.kpis.contactsMade ?? 0} tone="gold" />
          <StatCard label="GPS Overrides" value={overview?.kpis.gpsStatus.overrides ?? 0} />
        </section>

        <section className="grid four">
          <StatCard label="Pending Sync" value={(overview?.kpis.syncStatus.pending ?? 0) + (overview?.kpis.syncStatus.syncing ?? 0)} />
          <StatCard label="Conflicts" value={overview?.kpis.syncStatus.conflict ?? 0} tone="warning" />
          <StatCard label="GPS Exceptions" value={(overview?.kpis.gpsStatus.flagged ?? 0) + (overview?.kpis.gpsStatus.missing ?? 0) + (overview?.kpis.gpsStatus.lowAccuracy ?? 0)} tone="warning" />
          <StatCard label="Active Canvassers" value={overview?.kpis.activeCanvassers ?? 0} />
        </section>

        <div className="split">
          <Card className="stack">
            <div className="inline-actions inline-actions-between">
              <div>
                <p className="section-kicker">Productivity</p>
                <h2 className="heading-reset">By canvasser</h2>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    'productivity-report.csv',
                    productivity.map((row) => ({
                      canvasser: row.canvasserName,
                      email: row.email,
                      visits: row.totalVisits,
                      visited_homes: row.uniqueAddressesVisited,
                      contacts: row.contactsMade,
                      sessions: row.sessionsCount,
                      average_session_minutes: row.averageSessionMinutes,
                      houses_per_hour: row.housesPerHour,
                      gps_verified_rate: row.gpsVerifiedRate,
                      gps_flagged_rate: row.gpsFlaggedRate
                    }))
                  )
                }
                disabled={!productivity.length}
              >
                Export CSV
              </Button>
            </div>

            <div className="stack">
              {productivity.map((row) => (
                <div key={row.canvasserId} className="card card-subtle">
                  <div className="inline-actions inline-actions-between">
                    <strong>{row.canvasserName}</strong>
                    <Badge tone="default">{row.totalVisits} visits</Badge>
                  </div>
                  <div className="muted">{row.email}</div>
                  <div className="muted">
                    {row.uniqueAddressesVisited} visited homes, {row.contactsMade} contacts, {row.housesPerHour} houses/hour
                  </div>
                </div>
              ))}
              {!productivity.length ? <div className="empty-state muted">No productivity rows match the current filter set.</div> : null}
            </div>
          </Card>

          <Card className="stack">
            <div className="inline-actions inline-actions-between">
              <div>
                <p className="section-kicker">GPS Exceptions</p>
                <h2 className="heading-reset">Flagged, missing, low accuracy, and overrides</h2>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    'gps-exceptions.csv',
                    gpsExceptions.map((item) => ({
                      turf: item.turf.name,
                      address: item.address.addressLine1,
                      city: item.address.city,
                      state: item.address.state,
                      gps_status: item.gpsStatus,
                      override_flag: item.override.flag ? 'true' : 'false',
                      override_reason: item.override.reason ?? '',
                      canvasser: item.canvasser.name,
                      visit_time: item.visitTime
                    }))
                  )
                }
                disabled={!gpsExceptions.length}
              >
                Export CSV
              </Button>
            </div>

            <div className="stack">
              {gpsExceptions.slice(0, 20).map((item) => (
                <div key={item.visitId} className="card card-subtle">
                  <div className="inline-actions inline-actions-between">
                    <strong>{item.address.addressLine1}</strong>
                    <Badge tone={item.override.flag ? 'success' : item.gpsStatus === 'verified' ? 'default' : 'warning'}>
                      {item.override.flag ? 'Overridden' : item.gpsStatus}
                    </Badge>
                  </div>
                  <div className="muted">{item.turf.name}</div>
                  <div className="muted">
                    {item.canvasser.name} at {new Date(item.visitTime).toLocaleString()}
                  </div>
                </div>
              ))}
              {!gpsExceptions.length ? <div className="empty-state muted">No GPS exceptions match the current filter set.</div> : null}
            </div>
          </Card>
        </div>

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Audit Activity</p>
              <h2 className="heading-reset">Recent operational actions</h2>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'audit-activity.csv',
                  auditActivity.map((item) => ({
                    action_type: item.actionType,
                    entity_type: item.entityType,
                    entity_id: item.entityId,
                    actor: item.actorUser ? `${item.actorUser.firstName} ${item.actorUser.lastName}` : '',
                    actor_email: item.actorUser?.email ?? '',
                    reason_code: item.reasonCode ?? '',
                    created_at: item.createdAt
                  }))
                )
              }
              disabled={!auditActivity.length}
            >
              Export CSV
            </Button>
          </div>
          <div className="stack">
            {auditActivity.slice(0, 25).map((item) => (
              <div key={item.id} className="card card-subtle">
                <div className="inline-actions inline-actions-between">
                  <strong>{item.actionType}</strong>
                  <Badge tone="default">{new Date(item.createdAt).toLocaleString()}</Badge>
                </div>
                <div className="muted">
                  {item.entityType} / {item.entityId}
                </div>
                <div className="muted">
                  {item.actorUser ? `${item.actorUser.firstName} ${item.actorUser.lastName}` : 'System'}
                  {item.reasonCode ? ` • ${item.reasonCode}` : ''}
                </div>
              </div>
            ))}
            {!auditActivity.length ? <div className="empty-state muted">No audit activity matches the current filter set.</div> : null}
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}

function StatCard({
  label,
  value,
  tone = 'default'
}: {
  label: string;
  value: number;
  tone?: 'default' | 'gold' | 'success' | 'warning';
}) {
  return (
    <Card className="stat-card">
      <Badge tone={tone}>{label}</Badge>
      <div className="stat-value">{value}</div>
    </Card>
  );
}
