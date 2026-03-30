import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TurfStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { CsvMapping, resolveMappedValue, toOptionalNumber } from '../common/utils/csv.util';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type ImportRow = Record<string, unknown>;
type ImportMode = 'create_only' | 'upsert' | 'replace_turf_membership';
type DuplicateStrategy = 'skip' | 'error' | 'merge' | 'review';
type RowImportStatus = 'created' | 'merged' | 'skipped_invalid' | 'skipped_duplicate' | 'pending_review';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService
  ) {}

  private buildTimestampedFilename(prefix: string) {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
    return `${prefix}-${timestamp}.csv`;
  }

  private checksum(csv: string) {
    return createHash('sha256').update(csv).digest('hex');
  }

  private buildScope(scope: AccessScope | { organizationId?: string | null; campaignId?: string | null }) {
    return {
      organizationId: scope.organizationId ?? null,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {})
    } as const;
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

  private parseRow(rawRowJson: unknown): ImportRow {
    if (!rawRowJson || typeof rawRowJson !== 'object' || Array.isArray(rawRowJson)) {
      throw new BadRequestException('Import review row is missing raw CSV data');
    }

    return rawRowJson as ImportRow;
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
      combinedAddressLine1: [addressLine1, addressLine2, unit].filter(Boolean).join(', ')
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
    city: string;
    state: string;
    zip?: string | null;
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
        addressLine1: input.addressLine1,
        city: input.city,
        state: input.state,
        zip: input.zip ?? null,
        deletedAt: null
      }
    });
  }

  private async ensureHousehold(input: {
    organizationId: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
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
        city: input.city,
        state: input.state,
        zip: input.zip,
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
    mode?: ImportMode;
    duplicateStrategy?: DuplicateStrategy;
  }) {
    const creator = await this.usersService.findById(input.createdById);
    if (!creator.organizationId) {
      throw new BadRequestException('CSV imports require an organization-scoped admin account');
    }
    const policy = await this.policiesService.getEffectivePolicy({
      organizationId: creator.organizationId,
      campaignId: creator.campaignId ?? null
    });
    const mode = input.mode ?? policy.defaultImportMode;
    const duplicateStrategy = input.duplicateStrategy ?? policy.defaultDuplicateStrategy;
    const records = parse(input.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as ImportRow[];

    if (records.length === 0) {
      throw new BadRequestException('CSV file contains no rows');
    }

    const groupedRows = new Map<string, Array<{ row: ImportRow; rowIndex: number }>>();
    for (const [index, row] of records.entries()) {
      const resolvedTurfName = resolveMappedValue(row, 'turfName', input.mapping) ?? input.turfName ?? 'Imported Turf';
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
                campaignId: creator.campaignId ?? null
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
            campaignId: creator.campaignId ?? null,
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
          combinedAddressLine1
        } = this.extractRowAddress({ row, mapping: input.mapping });

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
          organizationId: creator.organizationId,
          addressLine1: combinedAddressLine1,
          city,
          state,
          zip,
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
                addressLine1: combinedAddressLine1,
                city,
                state,
                zip: zip ?? duplicate.zip,
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
            addressLine1: combinedAddressLine1,
            city,
            state,
            zip,
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

    const filename = this.buildTimestampedFilename('import-batch');
    const importBatch = await this.prisma.importBatch.create({
      data: {
        filename,
        organizationId: creator.organizationId ?? null,
        campaignId: creator.campaignId ?? null,
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
        mappingJson: (input.mapping ?? null) as never,
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

    if (!batch || !batch.csvContent) {
      throw new BadRequestException('Import batch not found');
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
      city,
      state,
      zip,
      vanPersonId,
      vanHouseholdId,
      latitude,
      longitude,
      combinedAddressLine1
    } = this.extractRowAddress({ row: rawRow, mapping });

    const updatedAddress = await this.prisma.address.update({
      where: { id: row.candidateAddress.id },
      data: {
        addressLine1: combinedAddressLine1 || row.candidateAddress.addressLine1,
        city: city || row.candidateAddress.city,
        state: state || row.candidateAddress.state,
        zip: zip ?? row.candidateAddress.zip,
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
