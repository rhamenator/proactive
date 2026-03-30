'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import { formatLocalDateTime, getLocalTimeZoneLabel } from '../../src/lib/datetime';
import type {
  AuditActivityItem,
  CampaignRecord,
  ExportBatchAnalyticsReport,
  FieldUserRecord,
  GpsExceptionRow,
  OutcomeDefinitionRecord,
  ProductivityRow,
  ReportFilters,
  ReportOverview,
  ResolvedConflictReport,
  TrendReport,
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

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

export default function ReportsPage() {
  const api = useAuthedApi();
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [productivity, setProductivity] = useState<ProductivityRow[]>([]);
  const [gpsExceptions, setGpsExceptions] = useState<GpsExceptionRow[]>([]);
  const [auditActivity, setAuditActivity] = useState<AuditActivityItem[]>([]);
  const [trends, setTrends] = useState<TrendReport | null>(null);
  const [resolvedConflicts, setResolvedConflicts] = useState<ResolvedConflictReport | null>(null);
  const [exportBatches, setExportBatches] = useState<ExportBatchAnalyticsReport | null>(null);
  const [turfs, setTurfs] = useState<TurfListItem[]>([]);
  const [canvassers, setCanvassers] = useState<FieldUserRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeDefinitionRecord[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: '',
    dateTo: '',
    campaignId: '',
    turfId: '',
    canvasserId: '',
    outcomeCode: '',
    overrideFlag: undefined,
    syncStatus: undefined,
    gpsStatus: undefined
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedFilters = useMemo<ReportFilters>(
    () => ({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      campaignId: filters.campaignId || undefined,
      turfId: filters.turfId || undefined,
      canvasserId: filters.canvasserId || undefined,
      outcomeCode: filters.outcomeCode || undefined,
      overrideFlag: filters.overrideFlag,
      syncStatus: filters.syncStatus || undefined,
      gpsStatus: filters.gpsStatus || undefined
    }),
    [filters]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewResult,
        productivityResult,
        gpsResult,
        auditResult,
        trendResult,
        resolvedResult,
        exportResult,
        turfResult,
        canvasserResult,
        campaignResult,
        outcomeResult
      ] = await Promise.all([
        api.reportsOverview(normalizedFilters),
        api.reportsProductivity(normalizedFilters),
        api.reportsGpsExceptions(normalizedFilters),
        api.reportsAuditActivity(normalizedFilters),
        api.reportsTrends(normalizedFilters),
        api.reportsResolvedConflicts(normalizedFilters),
        api.reportsExportBatches(normalizedFilters),
        api.listTurfs(),
        api.listCanvassers(),
        api.listCampaigns(),
        api.listOutcomeDefinitions()
      ]);

      setOverview(overviewResult);
      setProductivity(productivityResult.rows);
      setGpsExceptions(gpsResult.rows);
      setAuditActivity(auditResult.rows);
      setTrends(trendResult);
      setResolvedConflicts(resolvedResult);
      setExportBatches(exportResult);
      setTurfs(turfResult);
      setCanvassers(canvasserResult);
      setCampaigns(campaignResult);
      setOutcomes(outcomeResult);
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
              <p className="muted">
                Timestamps display in your local timezone ({getLocalTimeZoneLabel()}). Trend buckets are calculated in{' '}
                {trends?.bucketTimeZone ?? 'UTC'}.
              </p>
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
            <FilterSelect
              id="campaign-filter"
              label="Campaign"
              value={filters.campaignId ?? ''}
              onChange={(value) => setFilters((current) => ({ ...current, campaignId: value }))}
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="turf-filter"
              label="Turf"
              value={filters.turfId ?? ''}
              onChange={(value) => setFilters((current) => ({ ...current, turfId: value }))}
            >
              <option value="">All turfs</option>
              {turfs.map((turf) => (
                <option key={turf.id} value={turf.id}>
                  {turf.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="canvasser-filter"
              label="Canvasser"
              value={filters.canvasserId ?? ''}
              onChange={(value) => setFilters((current) => ({ ...current, canvasserId: value }))}
            >
              <option value="">All field users</option>
              {canvassers.map((canvasser) => (
                <option key={canvasser.id} value={canvasser.id}>
                  {canvasser.firstName} {canvasser.lastName}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="outcome-filter"
              label="Outcome"
              value={filters.outcomeCode ?? ''}
              onChange={(value) => setFilters((current) => ({ ...current, outcomeCode: value }))}
            >
              <option value="">All outcomes</option>
              {outcomes.map((outcome) => (
                <option key={outcome.id} value={outcome.code}>
                  {outcome.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="override-filter"
              label="Override flag"
              value={filters.overrideFlag === undefined ? '' : String(filters.overrideFlag)}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  overrideFlag: value === '' ? undefined : value === 'true'
                }))
              }
            >
              <option value="">All override states</option>
              <option value="true">Overrides only</option>
              <option value="false">Not overridden</option>
            </FilterSelect>
            <FilterSelect
              id="sync-status-filter"
              label="Sync status"
              value={filters.syncStatus ?? ''}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  syncStatus: value ? (value as ReportFilters['syncStatus']) : undefined
                }))
              }
            >
              <option value="">All sync states</option>
              <option value="pending">Pending</option>
              <option value="syncing">Syncing</option>
              <option value="synced">Synced</option>
              <option value="failed">Failed</option>
              <option value="conflict">Conflict</option>
            </FilterSelect>
            <FilterSelect
              id="gps-status-filter"
              label="GPS status"
              value={filters.gpsStatus ?? ''}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  gpsStatus: value ? (value as ReportFilters['gpsStatus']) : undefined
                }))
              }
            >
              <option value="">All GPS states</option>
              <option value="verified">Verified</option>
              <option value="flagged">Flagged</option>
              <option value="missing">Missing</option>
              <option value="low_accuracy">Low accuracy</option>
            </FilterSelect>
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
          <StatCard
            label="GPS Exceptions"
            value={(overview?.kpis.gpsStatus.flagged ?? 0) + (overview?.kpis.gpsStatus.missing ?? 0) + (overview?.kpis.gpsStatus.lowAccuracy ?? 0)}
            tone="warning"
          />
          <StatCard label="Active Canvassers" value={overview?.kpis.activeCanvassers ?? 0} />
        </section>

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Trends</p>
              <h2 className="heading-reset">Daily work output and outcome mix</h2>
            </div>
            <Badge tone="default">{trends?.summary.days ?? 0} days</Badge>
          </div>
          <section className="grid three">
            <StatCard label="Total Visits" value={trends?.summary.totalVisits ?? 0} />
            <StatCard label="Avg Visits/Day" value={trends?.summary.averageVisitsPerDay ?? 0} tone="gold" />
            <StatCard label="Outcome Types" value={trends?.byOutcome.length ?? 0} />
          </section>
          <div className="grid two">
            <Card className="stack card-subtle">
              <strong>By Day</strong>
              <div className="stack">
                {trends?.byDay.map((row) => (
                  <div key={row.day} className="inline-actions inline-actions-between">
                    <span>{row.day}</span>
                    <span className="muted">
                      {row.visits} visits, {row.contactsMade} contacts, {row.uniqueAddressesVisited} homes
                    </span>
                  </div>
                ))}
                {!trends?.byDay.length ? <div className="muted">No trend data for the selected filters.</div> : null}
              </div>
            </Card>
            <Card className="stack card-subtle">
              <strong>By Outcome</strong>
              <div className="stack">
                {trends?.byOutcome.map((row) => (
                  <div key={row.outcomeCode} className="inline-actions inline-actions-between">
                    <span>{row.outcomeLabel}</span>
                    <Badge tone="default">{row.total}</Badge>
                  </div>
                ))}
                {!trends?.byOutcome.length ? <div className="muted">No outcome trends for the selected filters.</div> : null}
              </div>
            </Card>
          </div>
        </Card>

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
                    {item.canvasser.name} at {formatLocalDateTime(item.visitTime)}
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
              <p className="section-kicker">Resolved Conflicts</p>
              <h2 className="heading-reset">Recently resolved sync issues</h2>
            </div>
            <Badge tone="warning">{resolvedConflicts?.summary.totalResolved ?? 0}</Badge>
          </div>
          <div className="stack">
            {resolvedConflicts?.rows.map((item) => (
              <Card key={item.id} className="stack card-subtle">
                <div className="inline-actions inline-actions-between">
                  <strong>{item.visitLogId}</strong>
                  <span className="muted">{formatLocalDateTime(item.resolvedAt)}</span>
                </div>
                <div className="muted">
                  {item.reasonText ?? 'No reason recorded'}
                  {item.actorUser ? ` • resolved by ${item.actorUser.firstName} ${item.actorUser.lastName}` : ''}
                </div>
              </Card>
            ))}
            {!resolvedConflicts?.rows.length ? <div className="empty-state muted">No resolved conflicts for the selected filters.</div> : null}
          </div>
        </Card>

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Export Analytics</p>
              <h2 className="heading-reset">Traceable export batches</h2>
            </div>
            <Badge tone="default">{exportBatches?.summary.totalBatches ?? 0} batches</Badge>
          </div>
          <section className="grid three">
            <StatCard label="Rows" value={exportBatches?.summary.totalRows ?? 0} />
            <StatCard label="Artifact-backed" value={exportBatches?.summary.artifactBackedBatches ?? 0} tone="success" />
            <StatCard label="Profiles" value={exportBatches?.summary.byProfile.length ?? 0} tone="gold" />
          </section>
          <div className="stack">
            {exportBatches?.rows.map((batch) => (
              <Card key={batch.id} className="stack card-subtle">
                <div className="inline-actions inline-actions-between">
                  <strong>{batch.filename}</strong>
                  <div className="inline-actions">
                    <Badge tone={batch.hasStoredArtifact ? 'success' : 'warning'}>
                      {batch.hasStoredArtifact ? 'Artifact stored' : 'Metadata only'}
                    </Badge>
                    <Badge tone="default">{batch.rowCount} rows</Badge>
                  </div>
                </div>
                <div className="muted">
                  {batch.profileCode}
                  {batch.turf?.name ? ` • ${batch.turf.name}` : ' • All turfs'}
                  {batch.initiatedByUser ? ` • ${batch.initiatedByUser.firstName} ${batch.initiatedByUser.lastName}` : ''}
                </div>
                <div className="muted">
                  {formatLocalDateTime(batch.createdAt)}
                  {batch.checksum ? ` • checksum ${batch.checksum.slice(0, 12)}...` : ''}
                  {batch.traceableVisitCount ? ` • ${batch.traceableVisitCount} traceable visits` : ''}
                </div>
              </Card>
            ))}
            {!exportBatches?.rows.length ? <div className="empty-state muted">No export batch analytics for the selected filters.</div> : null}
          </div>
        </Card>

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Audit Activity</p>
              <h2 className="heading-reset">Recent operational changes</h2>
            </div>
            <Badge tone="default">{auditActivity.length}</Badge>
          </div>
          <div className="stack">
            {auditActivity.slice(0, 10).map((entry) => (
              <div key={entry.id} className="card card-subtle">
                <div className="inline-actions inline-actions-between">
                  <strong>{entry.actionType}</strong>
                  <span className="muted">{formatLocalDateTime(entry.createdAt)}</span>
                </div>
                <div className="muted">
                  {entry.entityType} • {entry.entityId}
                  {entry.actorUser ? ` • ${entry.actorUser.firstName} ${entry.actorUser.lastName}` : ''}
                </div>
              </div>
            ))}
            {!auditActivity.length ? <div className="empty-state muted">No audit activity for the selected filters.</div> : null}
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
  value: number | string;
  tone?: 'default' | 'gold' | 'success' | 'warning';
}) {
  return (
    <Card className="stack card-subtle">
      <Badge tone={tone}>{label}</Badge>
      <strong className="stat-value">{value}</strong>
    </Card>
  );
}
