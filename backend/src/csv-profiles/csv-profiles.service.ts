import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CsvProfileDirection, type CsvProfile } from '../../generated/prisma/client.js';
import { stringify } from 'csv-stringify/sync';
import type { CsvMapping } from '../common/utils/csv.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type CsvProfileRecord = {
  id: string | null;
  direction: CsvProfileDirection;
  code: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  campaignId: string | null;
  isActive: boolean;
  explicitRecord: boolean;
  sourceScope: 'built_in' | 'organization' | 'campaign';
  mappingJson: CsvMapping | null;
  settingsJson: Record<string, unknown> | null;
};

type ResolveProfileInput = {
  direction: CsvProfileDirection;
  code: string;
  organizationId?: string | null;
  campaignId?: string | null;
};

const IMPORT_TEMPLATE_FIELDS: Array<keyof CsvMapping> = [
  'turfName',
  'addressLine1',
  'addressLine2',
  'unit',
  'city',
  'state',
  'zip',
  'vanHouseholdId',
  'vanPersonId',
  'vanId',
  'latitude',
  'longitude'
];

const PROACTIVE_TURF_IMPORT_V1_MAPPING: CsvMapping = {
  turfName: 'turf_name',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  unit: 'unit',
  city: 'city',
  state: 'state',
  zip: 'zip',
  vanHouseholdId: 'van_household_id',
  vanPersonId: 'van_person_id',
  vanId: 'van_id',
  latitude: 'latitude',
  longitude: 'longitude'
};

const PROACTIVE_CANVASS_RESULTS_V1_COLUMNS = [
  'van_id',
  'address_line1',
  'address_line2',
  'unit',
  'city',
  'state',
  'zip',
  'visit_time',
  'result',
  'contact_made',
  'notes',
  'time_zone',
  'gps_status',
  'latitude',
  'longitude',
  'accuracy_meters',
  'distance_from_target_feet',
  'sync_status',
  'canvasser_name'
];

const NGPVAN_VANCRM_BULK_CANVASS_RESULTS_V1_COLUMNS = [
  'VanId',
  'ResultID',
  'DateCanvassed'
];

const INTERNAL_MASTER_V1_COLUMNS = [
  'visit_id',
  'organization_id',
  'campaign_id',
  'team_id',
  'region_code',
  'turf_id',
  'turf_name',
  'address_id',
  'household_id',
  'household_van_household_id',
  'household_van_person_id',
  'van_id',
  'address_line1',
  'address_line2',
  'unit',
  'city',
  'state',
  'zip',
  'session_id',
  'visit_time',
  'client_created_at',
  'server_received_at',
  'outcome_definition_id',
  'outcome_code',
  'outcome_label',
  'is_final_disposition',
  'legacy_result',
  'attempt_number',
  'is_revisit',
  'contact_made',
  'notes',
  'sync_status',
  'sync_conflict_flag',
  'sync_conflict_reason',
  'gps_status',
  'geofence_validated',
  'geofence_distance_meters',
  'distance_from_target_feet',
  'geofence_failure_reason',
  'override_flag',
  'override_reason',
  'override_by_user_id',
  'override_at',
  'latitude',
  'longitude',
  'accuracy_meters',
  'local_record_uuid',
  'idempotency_key',
  'source',
  'canvasser_id',
  'canvasser_name',
  'time_zone',
  'van_exported'
];

const BUILT_IN_PROFILES: CsvProfileRecord[] = [
  {
    id: null,
    direction: CsvProfileDirection.import,
    code: 'proactive_turf_import_v1',
    name: 'PROACTIVE Turf Import v1',
    description: 'Versioned PROACTIVE interchange contract for turf and household imports.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: PROACTIVE_TURF_IMPORT_V1_MAPPING,
    settingsJson: {
      filenamePrefix: 'proactive-turf-import-v1',
      importMode: 'replace_turf_membership',
      duplicateStrategy: 'review',
      contractVersion: 'proactive-csv/v1'
    }
  },
  {
    id: null,
    direction: CsvProfileDirection.export,
    code: 'proactive_canvass_results_v1',
    name: 'PROACTIVE Canvass Results v1',
    description: 'Versioned PROACTIVE results interchange contract; adapt with a scoped profile for a specific VAN workflow.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: null,
    settingsJson: {
      filenamePrefix: 'proactive-canvass-results-v1',
      markExportedDefault: false,
      contractVersion: 'proactive-csv/v1',
      columns: PROACTIVE_CANVASS_RESULTS_V1_COLUMNS
    }
  },
  {
    id: null,
    direction: CsvProfileDirection.export,
    code: 'internal_master_v1',
    name: 'Internal Master v1',
    description: 'Versioned full operational export with sync, GPS, and audit fields.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: null,
    settingsJson: {
      filenamePrefix: 'internal-master-v1',
      markExportedDefault: false,
      contractVersion: 'proactive-csv/v1',
      columns: INTERNAL_MASTER_V1_COLUMNS
    }
  },
  {
    id: null,
    direction: CsvProfileDirection.export,
    code: 'ngpvan_vancrm_bulk_canvass_results_v1',
    name: 'NGP VAN CRM Bulk Canvass Results v1',
    description: 'Validated CSV file adapter for VAN CRM Bulk Import Jobs used by EveryAction 8, VoteBuilder, and SmartVAN. Requires scoped ResultID mappings.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: null,
    settingsJson: {
      filenamePrefix: 'ngpvan-vancrm-bulk-canvass-results-v1',
      markExportedDefault: false,
      adapterContract: 'ngpvan-vancrm-bulk-canvass-results/v1',
      validatedOn: '2026-08-07',
      columns: NGPVAN_VANCRM_BULK_CANVASS_RESULTS_V1_COLUMNS,
      columnSources: {
        VanId: 'van_id',
        ResultID: 'outcome_code',
        DateCanvassed: 'visit_time'
      },
      requiredColumns: NGPVAN_VANCRM_BULK_CANVASS_RESULTS_V1_COLUMNS,
      requiredMappedColumns: ['ResultID'],
      columnFormats: {
        VanId: 'positive-integer',
        ResultID: 'positive-integer',
        DateCanvassed: 'iso8601-offset'
      },
      valueMappings: {
        ResultID: {}
      }
    }
  },
  {
    id: null,
    direction: CsvProfileDirection.import,
    code: 'van_standard',
    name: 'VAN Standard Import',
    description: 'Default VAN-oriented import mapping with review-friendly duplicate handling.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: PROACTIVE_TURF_IMPORT_V1_MAPPING,
    settingsJson: {
      filenamePrefix: 'van-import',
      importMode: 'replace_turf_membership',
      duplicateStrategy: 'review'
    }
  },
  {
    id: null,
    direction: CsvProfileDirection.export,
    code: 'van_compatible',
    name: 'VAN Compatible Export',
    description: 'Operational export formatted for VAN-compatible downstream upload.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: null,
    settingsJson: {
      filenamePrefix: 'van-results',
      markExportedDefault: false,
      columns: PROACTIVE_CANVASS_RESULTS_V1_COLUMNS
    }
  },
  {
    id: null,
    direction: CsvProfileDirection.export,
    code: 'internal_master',
    name: 'Internal Master Export',
    description: 'Full internal export with sync, GPS, and audit-friendly visit fields.',
    organizationId: null,
    campaignId: null,
    isActive: true,
    explicitRecord: false,
    sourceScope: 'built_in',
    mappingJson: null,
    settingsJson: {
      filenamePrefix: 'internal-master',
      markExportedDefault: false,
      columns: INTERNAL_MASTER_V1_COLUMNS
    }
  }
];

@Injectable()
export class CsvProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private builtInProfile(direction: CsvProfileDirection, code: string) {
    return BUILT_IN_PROFILES.find((profile) => profile.direction === direction && profile.code === code) ?? null;
  }

  private sanitizeMapping(value: unknown): CsvMapping | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as CsvMapping;
  }

  private sanitizeSettings(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private toRecord(
    profile: Pick<CsvProfile, 'id' | 'direction' | 'code' | 'name' | 'description' | 'organizationId' | 'campaignId' | 'isActive' | 'mappingJson' | 'settingsJson'>,
    sourceScope: 'organization' | 'campaign'
  ): CsvProfileRecord {
    return {
      id: profile.id,
      direction: profile.direction,
      code: profile.code,
      name: profile.name,
      description: profile.description ?? null,
      organizationId: profile.organizationId ?? null,
      campaignId: profile.campaignId ?? null,
      isActive: profile.isActive,
      explicitRecord: true,
      sourceScope,
      mappingJson: this.sanitizeMapping(profile.mappingJson),
      settingsJson: this.sanitizeSettings(profile.settingsJson)
    };
  }

  private scopeWhere(input: ResolveProfileInput) {
    if (!input.organizationId) {
      return null;
    }

    return [
      {
        direction: input.direction,
        code: input.code,
        organizationId: input.organizationId,
        campaignId: input.campaignId ?? null
      },
      {
        direction: input.direction,
        code: input.code,
        organizationId: input.organizationId,
        campaignId: null
      }
    ];
  }

  async resolveProfile(input: ResolveProfileInput): Promise<CsvProfileRecord> {
    const scopedCandidates = this.scopeWhere(input);

    if (scopedCandidates) {
      const records = await this.prisma.csvProfile.findMany({
        where: {
          OR: scopedCandidates
        },
        orderBy: [{ campaignId: 'desc' }]
      });
      const exact = records.find((record) => record.campaignId === (input.campaignId ?? null));
      const organizationFallback = records.find((record) => record.campaignId === null);
      const selected = exact ?? organizationFallback;
      if (selected) {
        if (!selected.isActive) {
          throw new BadRequestException('CSV profile is inactive for the current scope');
        }
        return this.toRecord(selected, selected.campaignId ? 'campaign' : 'organization');
      }
    }

    const builtIn = this.builtInProfile(input.direction, input.code);
    if (builtIn && builtIn.isActive) {
      return builtIn;
    }

    throw new NotFoundException('CSV profile not found');
  }

  async listProfiles(scope: { organizationId: string | null; campaignId?: string | null }, direction: CsvProfileDirection, requestedCampaignId?: string | null) {
    const organizationId = scope.organizationId;
    const campaignId = requestedCampaignId ?? scope.campaignId ?? null;

    const scopedRecords = organizationId
      ? await this.prisma.csvProfile.findMany({
          where: {
            direction,
            organizationId,
            OR: [{ campaignId }, { campaignId: null }]
          },
          orderBy: [{ code: 'asc' }]
        })
      : [];

    const recordMap = new Map<string, CsvProfileRecord>();
    for (const record of scopedRecords) {
      recordMap.set(`${record.direction}:${record.code}:${record.campaignId ?? 'org'}`, this.toRecord(record, record.campaignId ? 'campaign' : 'organization'));
    }

    const effective = new Map<string, CsvProfileRecord>();
    for (const profile of BUILT_IN_PROFILES.filter((entry) => entry.direction === direction)) {
      effective.set(profile.code, profile);
    }

    for (const record of scopedRecords.filter((entry) => entry.campaignId === null)) {
      effective.set(record.code, this.toRecord(record, 'organization'));
    }
    for (const record of scopedRecords.filter((entry) => entry.campaignId === campaignId && campaignId !== null)) {
      effective.set(record.code, this.toRecord(record, 'campaign'));
    }

    for (const record of scopedRecords) {
      if (!effective.has(record.code)) {
        effective.set(record.code, this.toRecord(record, record.campaignId ? 'campaign' : 'organization'));
      }
    }

    return Array.from(effective.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  async upsertProfile(input: {
    direction: CsvProfileDirection;
    code: string;
    name: string;
    description?: string | null;
    organizationId: string;
    campaignId?: string | null;
    isActive?: boolean;
    mappingJson?: CsvMapping | null;
    settingsJson?: Record<string, unknown> | null;
  }) {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('CSV profile code is required');
    }

    const existing = await this.prisma.csvProfile.findFirst({
      where: {
        direction: input.direction,
        code,
        organizationId: input.organizationId,
        campaignId: input.campaignId ?? null
      }
    });

    const payload = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
      mappingJson: (input.mappingJson ?? null) as never,
      settingsJson: (input.settingsJson ?? null) as never
    };

    if (existing) {
      return this.prisma.csvProfile.update({
        where: { id: existing.id },
        data: payload
      });
    }

    return this.prisma.csvProfile.create({
      data: {
        direction: input.direction,
        code,
        organizationId: input.organizationId,
        campaignId: input.campaignId ?? null,
        ...payload
      }
    });
  }

  async clearProfile(input: {
    direction: CsvProfileDirection;
    code: string;
    organizationId: string;
    campaignId?: string | null;
  }) {
    const existing = await this.prisma.csvProfile.findFirst({
      where: {
        direction: input.direction,
        code: input.code,
        organizationId: input.organizationId,
        campaignId: input.campaignId ?? null
      }
    });

    if (!existing) {
      throw new NotFoundException('CSV profile override not found');
    }

    await this.prisma.csvProfile.delete({
      where: { id: existing.id }
    });
  }

  buildTemplateCsv(profile: CsvProfileRecord) {
    if (profile.direction === CsvProfileDirection.import) {
      const mapping = this.sanitizeMapping(profile.mappingJson) ?? {};
      const headers = IMPORT_TEMPLATE_FIELDS.map((field) => mapping[field] ?? field);
      return stringify([headers], { header: false, bom: true });
    }

    const settings = this.sanitizeSettings(profile.settingsJson) ?? {};
    const columns = Array.isArray(settings.columns)
      ? settings.columns.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];
    const headers = columns.length > 0 ? columns : ['result', 'address_line1', 'visit_time'];
    return stringify([headers], { header: false, bom: true });
  }
}
