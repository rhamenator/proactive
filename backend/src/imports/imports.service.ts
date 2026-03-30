import { BadRequestException, GoneException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TurfStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { buildNormalizedAddressKey, composeDisplayAddressLine1 } from '../common/utils/address-normalization.util';
import { CsvMapping, inferMappingFromHeaders, resolveMappedValue, toOptionalNumber } from '../common/utils/csv.util';
import { CsvProfilesService } from '../csv-profiles/csv-profiles.service';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type ImportRow = Record<string, unknown>;
type ImportMode = 'create_only' | 'upsert' | 'replace_turf_membership';
type DuplicateStrategy = 'skip' | 'error' | 'merge' | 'review';
type RowImportStatus = 'created' | 'merged' | 'skipped_invalid' | 'skipped_duplicate' | 'pending_review';
type ResolvedImportContext = {
  creator: Awaited<ReturnType<UsersService['findById']>>;
  policy: Awaited<ReturnType<PoliciesService['getEffectivePolicy']>>;
  team: Awaited<ReturnType<ImportsService['validateTeamScope']>>;
  regionCode: string | null;
  effectiveCampaignId: string | null;
  profile: Awaited<ReturnType<CsvProfilesService['resolveProfile']>>;
  profileSettings: Record<string, unknown>;
  mapping?: CsvMapping;
  mode: ImportMode;
  duplicateStrategy: DuplicateStrategy;
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService,
    private readonly csvProfilesService: CsvProfilesService
  ) {}

  private buildTimestampedFilename(prefix: string) {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
    return `${prefix}-${timestamp}.csv`;
  }

  private checksum(csv: string) {
    return createHash('sha256').update(csv).digest('hex');
  }

  private buildScope(scope: AccessScope | { organizationId?: string | null; campaignId?: string | null; teamId?: string | null; regionCode?: string | null }) {
    return {
      organizationId: scope.organizationId ?? null,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
      ...(scope.teamId ? { teamId: scope.teamId } : {}),
      ...(scope.regionCode ? { regionCode: scope.regionCode } : {})
    } as const;
  }

  private async validateTeamScope(organizationId: string | null, campaignId: string | null | undefined, teamId?: string | null) {
    if (!teamId) {
      return null;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId: organizationId ?? undefined,
        isActive: true
      }
    });

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    if (campaignId && team.campaignId && team.campaignId !== campaignId) {
      throw new BadRequestException('Team is outside the requested campaign scope');
    }

    return team;
  }

  private buildPurgeAt(days?: number | null) {
    if (!days || days <= 0) {
      return null;
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private parseMapping(mappingJson: unknown): CsvMapping | undefined {
    if (!mappingJson || typeof mappingJson !== 'object' || Array.isArray(mappingJson)) {
      return undefined;
    }

    return mappingJson as CsvMapping;
  }

  private buildEffectiveMapping(headers: string[], mapping?: CsvMapping) {
    const headerSet = new Set(headers);
    const inferredMapping = inferMappingFromHeaders(headers);
    const validExplicitMapping = Object.fromEntries(
      Object.entries(mapping ?? {}).filter(
        ([, header]) => typeof header === 'string' && header.trim().length > 0 && headerSet.has(header)
      )
    ) as CsvMapping;

    return {
      ...inferredMapping,
      ...validExplicitMapping
    } as CsvMapping;
  }

  private normalizeImportMode(value: unknown): ImportMode | undefined {
    if (value === 'create_only' || value === 'upsert' || value === 'replace_turf_membership') {
      return value;
    }

    return undefined;
  }

  private normalizeDuplicateStrategy(value: unknown): DuplicateStrategy | undefined {
    if (value === 'skip' || value === 'error' || value === 'merge' || value === 'review') {
      return value;
    }

    return undefined;
  }

  private profileSettings(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private parseRow(rawRowJson: unknown): ImportRow {
    if (!rawRowJson || typeof rawRowJson !== 'object' || Array.isArray(rawRowJson)) {
      throw new BadRequestException('Import review row is missing raw CSV data');
    }

    return rawRowJson as ImportRow;
  }

  private async resolveImportContext(input: {
    createdById: string;
    profileCode?: string | null;
    mapping?: CsvMapping;
    mode?: ImportMode;
    duplicateStrategy?: DuplicateStrategy;
    teamId?: string | null;
    regionCode?: string | null;
  }): Promise<ResolvedImportContext> {
    const creator = await this.usersService.findById(input.createdById);
    if (!creator.organizationId) {
      throw new BadRequestException('CSV imports require an organization-scoped admin account');
    }

    const team = await this.validateTeamScope(creator.organizationId ?? null, creator.campaignId ?? null, input.teamId);
    const regionCode = input.regionCode?.trim() || team?.regionCode || null;
    const effectiveCampaignId = creator.campaignId ?? team?.campaignId ?? null;
    const policy = await this.policiesService.getEffectivePolicy({
      organizationId: creator.organizationId,
      campaignId: effectiveCampaignId
    });
    const profileCode = input.profileCode?.trim() || policy.defaultImportProfileCode;
    const profile = await this.csvProfilesService.resolveProfile({
      direction: 'import',
      code: profileCode,
      organizationId: creator.organizationId,
      campaignId: effectiveCampaignId
    });
    const profileSettings = this.profileSettings(profile.settingsJson);
    const mapping = input.mapping ?? profile.mappingJson ?? undefined;
    const mode = input.mode ?? this.normalizeImportMode(profileSettings.importMode) ?? policy.defaultImportMode;
    const duplicateStrategy =
      input.duplicateStrategy ??
      this.normalizeDuplicateStrategy(profileSettings.duplicateStrategy) ??
      policy.defaultDuplicateStrategy;

    return {
      creator,
      policy,
      team,
      regionCode,
      effectiveCampaignId,
      profile,
      profileSettings,
      mapping,
      mode,
      duplicateStrategy
    };
  }

  private extractRowAddress(input: { row: ImportRow; mapping?: CsvMapping }) {
    const addressLine1 = resolveMappedValue(input.row, 'addressLine1', input.mapping);
    const addressLine2 = resolveMappedValue(input.row, 'addressLine2', input.mapping);
    const unit = resolveMappedValue(input.row, 'unit', input.mapping);
    const city = resolveMappedValue(input.row, 'city', input.mapping);
    const state = resolveMappedValue(input.row, 'state', input.mapping);
    const zip = resolveMappedValue(input.row, 'zip', input.mapping);
    const vanPersonId =
      resolveMappedValue(input.row, 'vanPersonId', input.mapping) ??
      resolveMappedValue(input.row, 'vanId', input.mapping);
    const vanHouseholdId =
      resolveMappedValue(input.row, 'vanHouseholdId', input.mapping) ??
      resolveMappedValue(input.row, 'vanId', input.mapping);
    const latitude = toOptionalNumber(resolveMappedValue(input.row, 'latitude', input.mapping));
    const longitude = toOptionalNumber(resolveMappedValue(input.row, 'longitude', input.mapping));

    return {
      addressLine1,
      addressLine2,
      unit,
      city,
      state,
      zip,
      vanPersonId,
      vanHouseholdId,
      latitude,
      longitude,
      normalizedAddressKey:
        addressLine1 && city && state
          ? buildNormalizedAddressKey({
              addressLine1,
              addressLine2,
              unit,
              city,
              state,
              zip
            })
          : null
    };
  }

  private findDuplicateAddress(input: {
    turfId: string;
    householdId: string;
  }) {
    return this.prisma.address.findFirst({
      where: {
        turfId: input.turfId,
        householdId: input.householdId,
        deletedAt: null
      }
    });
  }

  private findMatchingHousehold(input: {
    organizationId: string;
    addressLine1: string;
    addressLine2?: string | null;
    unit?: string | null;
    city: string;
    state: string;
    zip?: string | null;
    normalizedAddressKey: string;
    vanHouseholdId?: string | null;
    vanPersonId?: string | null;
  }) {
    if (input.vanHouseholdId) {
      return this.prisma.household.findFirst({
        where: {
          organizationId: input.organizationId,
          vanHouseholdId: input.vanHouseholdId,
          deletedAt: null
        }
      });
    }

    if (input.vanPersonId) {
      return this.prisma.household.findFirst({
        where: {
          organizationId: input.organizationId,
          vanPersonId: input.vanPersonId,
          deletedAt: null
        }
      });
    }

    return this.prisma.household.findFirst({
      where: {
        organizationId: input.organizationId,
        normalizedAddressKey: input.normalizedAddressKey,
        deletedAt: null
      }
    });
  }

  private async ensureHousehold(input: {
    organizationId: string;
    addressLine1: string;
    addressLine2?: string | null;
    unit?: string | null;
    city: string;
    state: string;
    zip?: string | null;
    normalizedAddressKey: string;
    latitude?: number | null;
    longitude?: number | null;
    vanHouseholdId?: string | null;
    vanPersonId?: string | null;
  }) {
    const existing = await this.findMatchingHousehold(input);
    if (existing) {
      if (
        (input.latitude !== null && input.latitude !== undefined && existing.latitude === null) ||
        (input.longitude !== null && input.longitude !== undefined && existing.longitude === null) ||
        (input.vanHouseholdId && !existing.vanHouseholdId) ||
        (input.vanPersonId && !existing.vanPersonId)
      ) {
        return this.prisma.household.update({
          where: { id: existing.id },
          data: {
            addressLine2: input.addressLine2 ?? existing.addressLine2,
            unit: input.unit ?? existing.unit,
            normalizedAddressKey: input.normalizedAddressKey,
            latitude: input.latitude ?? existing.latitude,
            longitude: input.longitude ?? existing.longitude,
            vanHouseholdId: input.vanHouseholdId ?? existing.vanHouseholdId,
            vanPersonId: input.vanPersonId ?? existing.vanPersonId
          }
        });
      }

      return existing;
    }

    return this.prisma.household.create({
      data: {
        organizationId: input.organizationId,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        unit: input.unit ?? null,
        city: input.city,
        state: input.state,
        zip: input.zip,
        normalizedAddressKey: input.normalizedAddressKey,
        latitude: input.latitude,
        longitude: input.longitude,
        vanHouseholdId: input.vanHouseholdId,
        vanPersonId: input.vanPersonId,
        source: 'csv_import',
        approvalStatus: 'approved'
      }
    });
  }

  async importCsv(input: {
    csv: string;
    createdById: string;
    turfName?: string;
    mapping?: CsvMapping;
    profileCode?: string | null;
    mode?: ImportMode;
    duplicateStrategy?: DuplicateStrategy;
    teamId?: string | null;
    regionCode?: string | null;
  }) {
    const {
      creator,
      policy,
      team,
      regionCode,
      effectiveCampaignId,
      profile,
      profileSettings,
      mapping,
      mode,
      duplicateStrategy
    } = await this.resolveImportContext(input);
    const records = parse(input.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as ImportRow[];

    if (records.length === 0) {
      throw new BadRequestException('CSV file contains no rows');
    }

    const headers = Object.keys(records[0] ?? {});
    const effectiveMapping = this.buildEffectiveMapping(headers, mapping);

    const groupedRows = new Map<string, Array<{ row: ImportRow; rowIndex: number }>>();
    for (const [index, row] of records.entries()) {
      const resolvedTurfName = resolveMappedValue(row, 'turfName', effectiveMapping) ?? input.turfName ?? 'Imported Turf';
      if (!groupedRows.has(resolvedTurfName)) {
        groupedRows.set(resolvedTurfName, []);
      }
      groupedRows.get(resolvedTurfName)!.push({ row, rowIndex: index + 1 });
    }

    const createdTurfs: string[] = [];
    const turfs: Array<{ id: string; name: string }> = [];
    let addressesImported = 0;
    let invalidRowsSkipped = 0;
    let duplicateRowsSkipped = 0;
    let duplicateRowsMerged = 0;
    let replacedMembershipsRemoved = 0;
    let pendingDuplicateReviews = 0;
    const rowResults: Array<{
      rowIndex: number;
      turfName: string;
      status: RowImportStatus;
      reasonCode: string | null;
      rawRowJson: ImportRow;
      addressId: string | null;
      candidateAddressId: string | null;
      householdId: string | null;
    }> = [];

    for (const [turfName, rows] of groupedRows.entries()) {
      const existingTurf =
        mode === 'upsert' || mode === 'replace_turf_membership'
          ? await this.prisma.turf.findFirst({
              where: {
                name: turfName,
                organizationId: creator.organizationId ?? null,
                campaignId: effectiveCampaignId,
                deletedAt: null,
                ...(team?.id ? { teamId: team.id } : {}),
                ...(regionCode ? { regionCode } : {})
              }
            })
          : null;

      const turf =
        existingTurf ??
        (await this.prisma.turf.create({
          data: {
            name: turfName,
            description: `Imported from CSV on ${new Date().toISOString()}`,
            createdById: input.createdById,
            organizationId: creator.organizationId ?? null,
            campaignId: effectiveCampaignId,
            teamId: team?.id ?? null,
            regionCode,
            status: TurfStatus.unassigned
          }
        }));

      if (!existingTurf) {
        createdTurfs.push(turf.id);
      }
      turfs.push({ id: turf.id, name: turf.name });
      const importedHouseholdIds = new Set<string>();

      for (const { row, rowIndex } of rows) {
        const {
          addressLine1,
          city,
          state,
          zip,
          vanPersonId,
          vanHouseholdId,
          latitude,
          longitude,
          addressLine2,
          unit,
          normalizedAddressKey
        } = this.extractRowAddress({ row, mapping: effectiveMapping });

        if (!addressLine1 || !city || !state) {
          invalidRowsSkipped += 1;
          rowResults.push({
            rowIndex,
            turfName,
            status: 'skipped_invalid',
            reasonCode: 'missing_required_fields',
            rawRowJson: row,
            addressId: null,
            candidateAddressId: null,
            householdId: null
          });
          continue;
        }
        const household = await this.ensureHousehold({
          organizationId: creator.organizationId!,
          addressLine1,
          addressLine2,
          unit,
          city,
          state,
          zip,
          normalizedAddressKey: normalizedAddressKey!,
          latitude,
          longitude,
          vanHouseholdId,
          vanPersonId
        });
        const duplicate = await this.findDuplicateAddress({
          turfId: turf.id,
          householdId: household.id
        });
        importedHouseholdIds.add(household.id);

        if (duplicate) {
          if (duplicateStrategy === 'error') {
            throw new BadRequestException(`Duplicate address detected for turf "${turfName}"`);
          }

          if (duplicateStrategy === 'review') {
            pendingDuplicateReviews += 1;
            rowResults.push({
              rowIndex,
              turfName,
              status: 'pending_review',
              reasonCode: 'duplicate_household_pending_review',
              rawRowJson: row,
              addressId: null,
              candidateAddressId: duplicate.id,
              householdId: household.id
            });
            continue;
          }

          if (duplicateStrategy === 'merge') {
            await this.prisma.address.update({
              where: { id: duplicate.id },
              data: {
                addressLine1,
                addressLine2: addressLine2 ?? duplicate.addressLine2,
                unit: unit ?? duplicate.unit,
                city,
                state,
                zip: zip ?? duplicate.zip,
                normalizedAddressKey: normalizedAddressKey ?? duplicate.normalizedAddressKey,
                vanId: vanHouseholdId ?? vanPersonId ?? duplicate.vanId,
                latitude: latitude ?? duplicate.latitude,
                longitude: longitude ?? duplicate.longitude
              }
            });
            duplicateRowsMerged += 1;
            rowResults.push({
              rowIndex,
              turfName,
              status: 'merged',
              reasonCode: 'duplicate_household',
              rawRowJson: row,
              addressId: duplicate.id,
              candidateAddressId: duplicate.id,
              householdId: household.id
            });
            continue;
          }

          duplicateRowsSkipped += 1;
          rowResults.push({
            rowIndex,
            turfName,
            status: 'skipped_duplicate',
            reasonCode: 'duplicate_household',
            rawRowJson: row,
            addressId: null,
            candidateAddressId: duplicate.id,
            householdId: household.id
          });
          continue;
        }

        const createdAddress = await this.prisma.address.create({
          data: {
            turfId: turf.id,
            householdId: household.id,
            organizationId: turf.organizationId,
            campaignId: turf.campaignId,
            teamId: turf.teamId,
            regionCode: turf.regionCode,
            addressLine1,
            addressLine2: addressLine2 ?? null,
            unit: unit ?? null,
            city,
            state,
            zip,
            normalizedAddressKey: normalizedAddressKey!,
            vanId: vanHouseholdId ?? vanPersonId,
            latitude,
            longitude
          }
        });
        addressesImported += 1;
        rowResults.push({
          rowIndex,
          turfName,
          status: 'created',
          reasonCode: null,
          rawRowJson: row,
          addressId: createdAddress.id,
          candidateAddressId: null,
          householdId: household.id
        });
      }

      if (mode === 'replace_turf_membership' && existingTurf && importedHouseholdIds.size > 0) {
        const removed = await this.prisma.address.updateMany({
          where: {
            turfId: turf.id,
            deletedAt: null,
            householdId: {
              notIn: Array.from(importedHouseholdIds)
            }
          },
          data: {
            deletedAt: new Date(),
            deleteReason: 'replace_turf_membership_import',
            purgeAt: this.buildPurgeAt(policy.retentionPurgeDays)
          }
        });

        replacedMembershipsRemoved += removed.count;
      }
    }

    const filenamePrefix =
      typeof profileSettings.filenamePrefix === 'string' && profileSettings.filenamePrefix.trim()
        ? profileSettings.filenamePrefix.trim()
        : 'import-batch';
    const filename = this.buildTimestampedFilename(filenamePrefix);
    const importBatch = await this.prisma.importBatch.create({
      data: {
        profileCode: profile.code,
        profileName: profile.name,
        filename,
        organizationId: creator.organizationId ?? null,
        campaignId: effectiveCampaignId,
        teamId: team?.id ?? null,
        regionCode,
        initiatedByUserId: input.createdById,
        mode,
        duplicateStrategy,
        turfNameFallback: input.turfName ?? null,
        rowCount: records.length,
        importedCount: addressesImported,
        mergedCount: duplicateRowsMerged,
        removedCount: replacedMembershipsRemoved,
        pendingReviewCount: pendingDuplicateReviews,
        invalidCount: invalidRowsSkipped,
        duplicateSkippedCount: duplicateRowsSkipped,
        mappingJson: (effectiveMapping ?? null) as never,
        csvContent: input.csv,
        sha256Checksum: this.checksum(input.csv),
        purgeAt: this.buildPurgeAt(policy.retentionPurgeDays),
        rows: {
          create: rowResults.map((row) => ({
            rowIndex: row.rowIndex,
            turfName: row.turfName,
            status: row.status,
            reasonCode: row.reasonCode,
            rawRowJson: row.rawRowJson as never,
            addressId: row.addressId,
            candidateAddressId: row.candidateAddressId,
            householdId: row.householdId
          }))
        }
      }
    });

    const result = {
      importBatchId: importBatch.id,
      filename,
      profileCode: profile.code,
      mode,
      duplicateStrategy,
      turfsCreated: createdTurfs.length,
      addressesImported,
      invalidRowsSkipped,
      duplicateRowsSkipped,
      duplicateRowsMerged,
      pendingDuplicateReviews,
      replacedMembershipsRemoved,
      turfs
    };

    await this.auditService.log({
      actorUserId: input.createdById,
      actionType: 'csv_import_completed',
      entityType: 'turf_import',
      entityId: createdTurfs[0] ?? turfs[0]?.id ?? 'none',
      newValuesJson: result
    });

    return result;
  }

  async previewCsv(input: {
    csv: string;
    createdById: string;
    turfName?: string;
    mapping?: CsvMapping;
    profileCode?: string | null;
    mode?: ImportMode;
    duplicateStrategy?: DuplicateStrategy;
    teamId?: string | null;
    regionCode?: string | null;
  }) {
    const { team, regionCode, effectiveCampaignId, profile, mapping, mode, duplicateStrategy } =
      await this.resolveImportContext(input);

    const records = parse(input.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as ImportRow[];

    if (records.length === 0) {
      throw new BadRequestException('CSV file contains no rows');
    }

    const headers = Object.keys(records[0] ?? {});
    const headerSet = new Set(headers);
    const effectiveMapping = this.buildEffectiveMapping(headers, mapping);
    const requiredMappedFields: Array<keyof CsvMapping> = ['addressLine1', 'city', 'state'];
    const profileMappingEntries = Object.entries(mapping ?? {});
    const missingHeaders = profileMappingEntries
      .filter(([, header]) => typeof header === 'string' && header.trim().length > 0 && !headerSet.has(header))
      .map(([field]) => field)
      .sort();

    const missingRequiredMappings = requiredMappedFields.filter((field) => {
      const mappedHeader = effectiveMapping[field];
      return !mappedHeader || !headerSet.has(mappedHeader);
    });

    let rowsReady = 0;
    let rowsMissingRequired = 0;
    let rowsUsingFallbackTurf = 0;
    const turfNames = new Set<string>();
    const sampleRows = records.slice(0, 10).map((row, index) => {
      const rowIndex = index + 1;
      const {
        addressLine1,
        addressLine2,
        unit,
        city,
        state
      } = this.extractRowAddress({ row, mapping: effectiveMapping });
      const mappedTurfName = resolveMappedValue(row, 'turfName', effectiveMapping);
      const turfName = mappedTurfName ?? input.turfName ?? 'Imported Turf';
      const status = addressLine1 && city && state ? 'ready' : 'missing_required_fields';
      if (status === 'ready') {
        rowsReady += 1;
      } else {
        rowsMissingRequired += 1;
      }
      if (!mappedTurfName && Boolean(input.turfName)) {
        rowsUsingFallbackTurf += 1;
      }
      turfNames.add(turfName);

      return {
        rowIndex,
        turfName,
        addressLine1: addressLine1
          ? composeDisplayAddressLine1({
              addressLine1,
              addressLine2,
              unit
            })
          : '',
        city: city ?? '',
        state: state ?? '',
        status
      };
    });

    for (const row of records.slice(10)) {
      const { addressLine1, city, state } = this.extractRowAddress({ row, mapping: effectiveMapping });
      const mappedTurfName = resolveMappedValue(row, 'turfName', effectiveMapping);
      const turfName = mappedTurfName ?? input.turfName ?? 'Imported Turf';
      if (addressLine1 && city && state) {
        rowsReady += 1;
      } else {
        rowsMissingRequired += 1;
      }
      if (!mappedTurfName && Boolean(input.turfName)) {
        rowsUsingFallbackTurf += 1;
      }
      turfNames.add(turfName);
    }

    return {
      profileCode: profile.code,
      profileName: profile.name,
      mode,
      duplicateStrategy,
      rowCount: records.length,
      headerCount: headers.length,
      headers,
      missingHeaders,
      missingRequiredMappings,
      turfNames: Array.from(turfNames).sort(),
      rowsReady,
      rowsMissingRequired,
      rowsUsingFallbackTurf,
      scope: {
        campaignId: effectiveCampaignId,
        teamId: team?.id ?? input.teamId ?? null,
        regionCode
      },
      sampleRows
    };
  }

  async importHistory(scope: AccessScope) {
    return this.prisma.importBatch.findMany({
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
            isActive: true,
            status: true,
            mfaEnabled: true,
            invitedAt: true,
            activatedAt: true,
            lastLoginAt: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            rows: true
          }
        }
      }
    });
  }

  async downloadImportBatch(batchId: string, scope: AccessScope) {
    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: batchId,
        ...this.buildScope(scope)
      }
    });

    if (!batch) {
      throw new BadRequestException('Import batch not found');
    }
    if (!batch.csvContent) {
      throw new GoneException('The stored import source artifact has been purged by retention policy');
    }

    return {
      csv: batch.csvContent,
      filename: batch.filename,
      checksum: batch.sha256Checksum
    };
  }

  async importReviewQueue(input: {
    scope: AccessScope;
    take?: number;
  }) {
    const rows = await this.prisma.importBatchRow.findMany({
      where: {
        status: 'pending_review',
        importBatch: this.buildScope(input.scope)
      },
      orderBy: [{ createdAt: 'desc' }],
      take: input.take ?? 50,
      include: {
        importBatch: {
          select: {
            id: true,
            filename: true,
            createdAt: true,
            mode: true,
            duplicateStrategy: true
          }
        },
        candidateAddress: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true,
            vanId: true,
            turf: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        household: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true,
            vanHouseholdId: true,
            vanPersonId: true
          }
        }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      rowIndex: row.rowIndex,
      turfName: row.turfName,
      status: row.status,
      reasonCode: row.reasonCode,
      createdAt: row.createdAt,
      rawRow: row.rawRowJson,
      importBatch: row.importBatch,
      candidateAddress: row.candidateAddress,
      household: row.household
    }));
  }

  async resolveImportReview(input: {
    rowId: string;
    scope: AccessScope;
    actorUserId: string;
    action: 'merge' | 'skip';
    reason?: string;
  }) {
    const row = await this.prisma.importBatchRow.findFirst({
      where: {
        id: input.rowId,
        status: 'pending_review',
        importBatch: this.buildScope(input.scope)
      },
      include: {
        importBatch: {
          select: {
            id: true,
            filename: true,
            createdAt: true,
            mode: true,
            duplicateStrategy: true,
            mappingJson: true
          }
        },
        candidateAddress: true
      }
    });

    if (!row) {
      throw new BadRequestException('Import review row not found');
    }

    const resolvedAt = new Date();
    const resolutionReason = input.reason?.trim() || null;

    if (input.action === 'skip') {
      const updated = await this.prisma.importBatchRow.update({
        where: { id: row.id },
        data: {
          status: 'skipped_duplicate',
          reasonCode: 'duplicate_household_reviewed_skip',
          resolutionAction: 'skip',
          resolutionReason,
          resolvedAt,
          resolvedByUserId: input.actorUserId
        }
      });

      await this.prisma.importBatch.update({
        where: { id: row.importBatchId },
        data: {
          pendingReviewCount: {
            decrement: 1
          },
          duplicateSkippedCount: {
            increment: 1
          }
        }
      });

      await this.auditService.log({
        actorUserId: input.actorUserId,
        actionType: 'import_duplicate_review_resolved',
        entityType: 'import_batch_row',
        entityId: row.id,
        reasonCode: 'skip',
        reasonText: resolutionReason ?? undefined,
        newValuesJson: {
          status: updated.status,
          importBatchId: row.importBatchId
        }
      });

      return {
        id: updated.id,
        status: updated.status,
        resolutionAction: updated.resolutionAction,
        resolvedAt: updated.resolvedAt
      };
    }

    if (!row.candidateAddress) {
      throw new BadRequestException('Duplicate candidate address is missing');
    }

    const mapping = this.parseMapping(row.importBatch.mappingJson);
    const rawRow = this.parseRow(row.rawRowJson);
    const {
      addressLine1,
      city,
      state,
      zip,
      vanPersonId,
      vanHouseholdId,
      latitude,
      longitude,
      addressLine2,
      unit,
      normalizedAddressKey
    } = this.extractRowAddress({ row: rawRow, mapping });

    const updatedAddress = await this.prisma.address.update({
      where: { id: row.candidateAddress.id },
      data: {
        addressLine1: addressLine1 || row.candidateAddress.addressLine1,
        addressLine2: addressLine2 ?? row.candidateAddress.addressLine2,
        unit: unit ?? row.candidateAddress.unit,
        city: city || row.candidateAddress.city,
        state: state || row.candidateAddress.state,
        zip: zip ?? row.candidateAddress.zip,
        normalizedAddressKey: normalizedAddressKey ?? row.candidateAddress.normalizedAddressKey,
        vanId: vanHouseholdId ?? vanPersonId ?? row.candidateAddress.vanId,
        latitude: latitude ?? row.candidateAddress.latitude,
        longitude: longitude ?? row.candidateAddress.longitude
      }
    });

    const updatedRow = await this.prisma.importBatchRow.update({
      where: { id: row.id },
      data: {
        status: 'merged',
        reasonCode: 'duplicate_household_reviewed_merge',
        addressId: updatedAddress.id,
        resolutionAction: 'merge',
        resolutionReason,
        resolvedAt,
        resolvedByUserId: input.actorUserId
      }
    });

    await this.prisma.importBatch.update({
      where: { id: row.importBatchId },
      data: {
        pendingReviewCount: {
          decrement: 1
        },
        mergedCount: {
          increment: 1
        }
      }
    });

    await this.auditService.log({
      actorUserId: input.actorUserId,
      actionType: 'import_duplicate_review_resolved',
      entityType: 'import_batch_row',
      entityId: row.id,
      reasonCode: 'merge',
      reasonText: resolutionReason ?? undefined,
      newValuesJson: {
        status: updatedRow.status,
        importBatchId: row.importBatchId,
        addressId: updatedAddress.id
      }
    });

    return {
      id: updatedRow.id,
      status: updatedRow.status,
      resolutionAction: updatedRow.resolutionAction,
      resolvedAt: updatedRow.resolvedAt,
      addressId: updatedAddress.id
    };
  }
}
