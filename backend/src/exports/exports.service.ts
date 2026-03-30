import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { attachVisitAttemptMetrics } from '../common/utils/visit-analytics.util';
import { CsvProfilesService } from '../csv-profiles/csv-profiles.service';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';

type ExportOptions = {
  turfId?: string;
  markExported?: boolean;
  profileCode?: string;
  actorUserId?: string;
  organizationId?: string | null;
  campaignId?: string | null;
  teamId?: string | null;
  regionCode?: string | null;
};

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService,
    private readonly csvProfilesService: CsvProfilesService
  ) {}

  private buildTimestampedFilename(prefix: string) {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
    return `${prefix}-${timestamp}.csv`;
  }

  private buildScope(scope: AccessScope | ExportOptions) {
    return {
      organizationId: scope.organizationId ?? null,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
      ...(scope.teamId ? { teamId: scope.teamId } : {}),
      ...(scope.regionCode ? { regionCode: scope.regionCode } : {})
    } as const;
  }

  private async fetchVisits(options?: ExportOptions) {
    return this.prisma.visitLog.findMany({
      where: {
        ...this.buildScope(options ?? { organizationId: null }),
        deletedAt: null,
        syncStatus: { not: 'conflict' },
        syncConflictFlag: false,
        ...(options?.turfId ? { turfId: options.turfId } : {}),
        ...(options?.markExported === false ? {} : { vanExported: false })
      },
      orderBy: { visitTime: 'asc' },
      include: {
        address: {
          include: {
            household: true
          }
        },
        canvasser: true,
        geofenceResult: true,
        outcomeDefinition: true,
        turf: true
      }
    });
  }

  private async loadVisitAttemptHistory(
    visits: Array<{
      id: string;
      turfId: string;
      addressId: string;
      visitTime: Date;
    }>
  ) {
    if (visits.length === 0) {
      return [];
    }

    const pairs = Array.from(new Map(visits.map((visit) => [`${visit.turfId}:${visit.addressId}`, visit])).values());

    return this.prisma.visitLog.findMany({
      where: {
        deletedAt: null,
        syncStatus: { not: 'conflict' },
        syncConflictFlag: false,
        OR: pairs.map((visit) => ({
          turfId: visit.turfId,
          addressId: visit.addressId
        }))
      },
      select: {
        id: true,
        turfId: true,
        addressId: true,
        visitTime: true
      }
    });
  }

  private checksum(csv: string) {
    return createHash('sha256').update(csv).digest('hex');
  }

  private profileSettings(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private normalizeColumns(value: unknown, fallback: string[]) {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const columns = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return columns.length > 0 ? columns : fallback;
  }

  private renderRows(rows: Array<Record<string, unknown>>, columns: string[]) {
    return rows.map((row) => {
      const rendered: Record<string, unknown> = {};
      for (const column of columns) {
        rendered[column] = row[column] ?? '';
      }
      return rendered;
    });
  }

  private buildPurgeAt(days?: number | null) {
    if (!days || days <= 0) {
      return null;
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async recordExportBatch(input: {
    profileCode: string;
    profileName?: string | null;
    filename: string;
    csv: string;
    rowCount: number;
    turfId?: string;
    actorUserId?: string;
    markExported: boolean;
    scope: AccessScope;
    visits: Array<{ id: string }>;
    rows: Array<Record<string, unknown>>;
  }) {
    const policy = await this.policiesService.getEffectivePolicy(input.scope);

    return this.prisma.exportBatch.create({
      data: {
        profileCode: input.profileCode,
        profileName: input.profileName ?? null,
        filename: input.filename,
        organizationId: input.scope.organizationId,
        campaignId: input.scope.campaignId ?? null,
        teamId: input.scope.teamId ?? null,
        regionCode: input.scope.regionCode ?? null,
        turfId: input.turfId,
        initiatedByUserId: input.actorUserId ?? null,
        markExported: input.markExported,
        rowCount: input.rowCount,
        filterScopeJson: {
          turfId: input.turfId ?? null,
          organizationId: input.scope.organizationId,
          campaignId: input.scope.campaignId ?? null,
          teamId: input.scope.teamId ?? null,
          regionCode: input.scope.regionCode ?? null
        },
        csvContent: input.csv,
        sha256Checksum: this.checksum(input.csv),
        purgeAt: this.buildPurgeAt(policy.retentionPurgeDays),
        exportedVisits: {
          create: input.visits.map((visit, index) => ({
            visitLog: {
              connect: { id: visit.id }
            },
            rowIndex: index + 1,
            rowSnapshotJson: (input.rows[index] ?? null) as Prisma.InputJsonValue
          }))
        }
      },
      include: {
        exportedVisits: true
      }
    });
  }

  async exportHistory(scope: AccessScope) {
    return this.prisma.exportBatch.findMany({
      where: this.buildScope(scope),
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        initiatedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            organizationId: true,
            campaignId: true,
            teamId: true,
            regionCode: true,
            isActive: true,
            status: true,
            mfaEnabled: true,
            invitedAt: true,
            activatedAt: true,
            lastLoginAt: true,
            createdAt: true
          }
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            exportedVisits: true
          }
        }
      }
    });
  }

  async downloadExportBatch(batchId: string, scope: AccessScope) {
    const batch = await this.prisma.exportBatch.findFirst({
      where: {
        id: batchId,
        ...this.buildScope(scope)
      }
    });

    if (!batch) {
      throw new NotFoundException('Export batch not found');
    }
    if (!batch.csvContent) {
      throw new GoneException('The stored export artifact has been purged by retention policy');
    }

    return {
      csv: batch.csvContent,
      filename: batch.filename,
      checksum: batch.sha256Checksum
    };
  }

  async vanResultsCsv(options?: ExportOptions) {
    const scope = {
      organizationId: options?.organizationId ?? null,
      campaignId: options?.campaignId ?? null,
      teamId: options?.teamId ?? null,
      regionCode: options?.regionCode ?? null
    };
    const policy = scope.organizationId
      ? await this.policiesService.getEffectivePolicy(scope)
      : null;
    const profileCode = options?.profileCode ?? policy?.defaultVanExportProfileCode ?? 'van_compatible';
    const profile = await this.csvProfilesService.resolveProfile({
      direction: 'export',
      code: profileCode,
      organizationId: scope.organizationId,
      campaignId: scope.campaignId ?? null
    });
    const profileSettings = this.profileSettings(profile.settingsJson);
    const loadedVisits = await this.fetchVisits(options);
    const visits = attachVisitAttemptMetrics(loadedVisits, await this.loadVisitAttemptHistory(loadedVisits));
    const baseRows = visits.map((visit) => ({
      van_id: visit.address.vanId ?? '',
      address_line1: visit.address.addressLine1,
      address_line2: visit.address.addressLine2 ?? '',
      unit: visit.address.unit ?? '',
      city: visit.address.city,
      state: visit.address.state,
      zip: visit.address.zip ?? '',
      visit_time: visit.visitTime.toISOString(),
      result: visit.result,
      contact_made: visit.contactMade ? 'true' : 'false',
      notes: visit.notes ?? '',
      time_zone: 'UTC',
      gps_status: visit.gpsStatus,
      latitude: visit.latitude?.toString() ?? '',
      longitude: visit.longitude?.toString() ?? '',
      accuracy_meters: visit.accuracyMeters?.toString() ?? '',
      distance_from_target_feet: visit.geofenceResult?.distanceFromTargetFeet?.toString() ?? '',
      sync_status: visit.syncStatus,
      canvasser_name: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim()
    }));
    const columns = this.normalizeColumns(profileSettings.columns, Object.keys(baseRows[0] ?? {
      van_id: '',
      address_line1: '',
      visit_time: '',
      result: '',
      contact_made: '',
      notes: '',
      time_zone: '',
      gps_status: '',
      latitude: '',
      longitude: '',
      accuracy_meters: '',
      distance_from_target_feet: '',
      sync_status: '',
      canvasser_name: ''
    }));
    const rows = this.renderRows(baseRows, columns);
    const filenamePrefix =
      typeof profileSettings.filenamePrefix === 'string' && profileSettings.filenamePrefix.trim()
        ? profileSettings.filenamePrefix.trim()
        : 'van-results';
    const filename = this.buildTimestampedFilename(filenamePrefix);

    const csv = stringify(rows, {
      header: true,
      bom: true
    });

    const markExported =
      options?.markExported ??
      (typeof profileSettings.markExportedDefault === 'boolean' ? profileSettings.markExportedDefault : false);

    if (markExported && visits.length > 0) {
      await this.prisma.visitLog.updateMany({
        where: { id: { in: visits.map((visit) => visit.id) } },
        data: { vanExported: true }
      });
    }
    await this.recordExportBatch({
      profileCode: profile.code,
      profileName: profile.name,
      filename,
      csv,
      rowCount: visits.length,
      turfId: options?.turfId,
      actorUserId: options?.actorUserId,
      markExported,
      scope,
      visits,
      rows
    });

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        organizationId: scope.organizationId,
        campaignId: scope.campaignId,
        teamId: scope.teamId,
        regionCode: scope.regionCode,
        markExported,
        count: visits.length,
        profileCode: profile.code
      }
    });

    return { csv, count: visits.length, filename };
  }

  async internalMasterCsv(options?: ExportOptions) {
    const scope = {
      organizationId: options?.organizationId ?? null,
      campaignId: options?.campaignId ?? null,
      teamId: options?.teamId ?? null,
      regionCode: options?.regionCode ?? null
    };
    const policy = scope.organizationId
      ? await this.policiesService.getEffectivePolicy(scope)
      : null;
    const profileCode = options?.profileCode ?? policy?.defaultInternalExportProfileCode ?? 'internal_master';
    const profile = await this.csvProfilesService.resolveProfile({
      direction: 'export',
      code: profileCode,
      organizationId: scope.organizationId,
      campaignId: scope.campaignId ?? null
    });
    const profileSettings = this.profileSettings(profile.settingsJson);
    const loadedVisits = await this.fetchVisits({
      ...options,
      markExported: false
    });
    const visits = attachVisitAttemptMetrics(loadedVisits, await this.loadVisitAttemptHistory(loadedVisits));
    const baseRows = visits.map((visit) => ({
      visit_id: visit.id,
      organization_id: visit.organizationId ?? '',
      campaign_id: visit.campaignId ?? '',
      team_id: visit.teamId ?? '',
      region_code: visit.regionCode ?? '',
      turf_id: visit.turfId,
      turf_name: visit.turf.name,
      address_id: visit.addressId,
      household_id: visit.address.householdId,
      household_van_household_id: visit.address.household?.vanHouseholdId ?? '',
      household_van_person_id: visit.address.household?.vanPersonId ?? '',
      van_id: visit.address.vanId ?? '',
      address_line1: visit.address.addressLine1,
      address_line2: visit.address.addressLine2 ?? '',
      unit: visit.address.unit ?? '',
      city: visit.address.city,
      state: visit.address.state,
      zip: visit.address.zip ?? '',
      session_id: visit.sessionId ?? '',
      visit_time: visit.visitTime.toISOString(),
      client_created_at: visit.clientCreatedAt?.toISOString() ?? '',
      server_received_at: visit.serverReceivedAt.toISOString(),
      outcome_definition_id: visit.outcomeDefinitionId ?? '',
      outcome_code: visit.outcomeCode,
      outcome_label: visit.outcomeLabel,
      is_final_disposition: visit.outcomeDefinition?.isFinalDisposition ? 'true' : 'false',
      legacy_result: visit.result,
      attempt_number: String(visit.attemptNumber),
      is_revisit: visit.isRevisit ? 'true' : 'false',
      contact_made: visit.contactMade ? 'true' : 'false',
      notes: visit.notes ?? '',
      sync_status: visit.syncStatus,
      sync_conflict_flag: visit.syncConflictFlag ? 'true' : 'false',
      sync_conflict_reason: visit.syncConflictReason ?? '',
      gps_status: visit.gpsStatus,
      geofence_validated: visit.geofenceValidated ? 'true' : 'false',
      geofence_distance_meters: visit.geofenceDistanceMeters?.toString() ?? '',
      distance_from_target_feet: visit.geofenceResult?.distanceFromTargetFeet?.toString() ?? '',
      geofence_failure_reason: visit.geofenceResult?.failureReason ?? '',
      override_flag: visit.geofenceResult?.overrideFlag ? 'true' : 'false',
      override_reason: visit.geofenceResult?.overrideReason ?? '',
      override_by_user_id: visit.geofenceResult?.overrideByUserId ?? '',
      override_at: visit.geofenceResult?.overrideAt?.toISOString() ?? '',
      latitude: visit.latitude?.toString() ?? '',
      longitude: visit.longitude?.toString() ?? '',
      accuracy_meters: visit.accuracyMeters?.toString() ?? '',
      local_record_uuid: visit.localRecordUuid ?? '',
      idempotency_key: visit.idempotencyKey ?? '',
      source: visit.source,
      canvasser_id: visit.canvasserId,
      canvasser_name: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim(),
      time_zone: 'America/Detroit',
      van_exported: visit.vanExported ? 'true' : 'false'
    }));
    const columns = this.normalizeColumns(profileSettings.columns, Object.keys(baseRows[0] ?? {
      visit_id: '',
      turf_id: '',
      turf_name: '',
      address_id: '',
      van_id: '',
      address_line1: '',
      city: '',
      state: '',
      zip: '',
      visit_time: ''
    }));
    const rows = this.renderRows(baseRows, columns);
    const filenamePrefix =
      typeof profileSettings.filenamePrefix === 'string' && profileSettings.filenamePrefix.trim()
        ? profileSettings.filenamePrefix.trim()
        : 'internal-master';
    const filename = this.buildTimestampedFilename(filenamePrefix);

    const csv = stringify(rows, {
      header: true,
      bom: true
    });
    await this.recordExportBatch({
      profileCode: profile.code,
      profileName: profile.name,
      filename,
      csv,
      rowCount: visits.length,
      turfId: options?.turfId,
      actorUserId: options?.actorUserId,
      markExported: false,
      scope,
      visits,
      rows
    });

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        organizationId: scope.organizationId,
        campaignId: scope.campaignId,
        teamId: scope.teamId,
        regionCode: scope.regionCode,
        markExported: false,
        count: visits.length,
        profileCode: profile.code
      }
    });

    return { csv, count: visits.length, filename };
  }
}
