import { BadRequestException, Injectable } from '@nestjs/common';
import { TurfStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { AuditService } from '../audit/audit.service';
import { CsvMapping, resolveMappedValue, toOptionalNumber } from '../common/utils/csv.util';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type ImportRow = Record<string, unknown>;
type ImportMode = 'create_only' | 'upsert';
type DuplicateStrategy = 'skip' | 'error' | 'merge';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService
  ) {}

  private findDuplicateAddress(input: {
    turfId: string;
    vanId?: string | null;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string | null;
  }) {
    return this.prisma.address.findFirst({
      where: input.vanId
        ? {
            turfId: input.turfId,
            vanId: input.vanId
          }
        : {
            turfId: input.turfId,
            addressLine1: input.addressLine1,
            city: input.city,
            state: input.state,
            zip: input.zip ?? null
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
    const mode = input.mode ?? 'create_only';
    const duplicateStrategy = input.duplicateStrategy ?? 'skip';
    const records = parse(input.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as ImportRow[];

    if (records.length === 0) {
      throw new BadRequestException('CSV file contains no rows');
    }

    const groupedRows = new Map<string, ImportRow[]>();
    for (const row of records) {
      const resolvedTurfName = resolveMappedValue(row, 'turfName', input.mapping) ?? input.turfName ?? 'Imported Turf';
      if (!groupedRows.has(resolvedTurfName)) {
        groupedRows.set(resolvedTurfName, []);
      }
      groupedRows.get(resolvedTurfName)!.push(row);
    }

    const createdTurfs: string[] = [];
    const turfs: Array<{ id: string; name: string }> = [];
    let addressesImported = 0;
    let invalidRowsSkipped = 0;
    let duplicateRowsSkipped = 0;
    let duplicateRowsMerged = 0;

    for (const [turfName, rows] of groupedRows.entries()) {
      const existingTurf =
        mode === 'upsert'
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

      for (const row of rows) {
        const addressLine1 = resolveMappedValue(row, 'addressLine1', input.mapping);
        const addressLine2 = resolveMappedValue(row, 'addressLine2', input.mapping);
        const unit = resolveMappedValue(row, 'unit', input.mapping);
        const city = resolveMappedValue(row, 'city', input.mapping);
        const state = resolveMappedValue(row, 'state', input.mapping);
        const zip = resolveMappedValue(row, 'zip', input.mapping);
        const vanId =
          resolveMappedValue(row, 'vanId', input.mapping) ??
          resolveMappedValue(row, 'vanHouseholdId', input.mapping) ??
          resolveMappedValue(row, 'vanPersonId', input.mapping);

        if (!addressLine1 || !city || !state) {
          invalidRowsSkipped += 1;
          continue;
        }

        const combinedAddressLine1 = [addressLine1, addressLine2, unit].filter(Boolean).join(', ');
        const duplicate = await this.findDuplicateAddress({
          turfId: turf.id,
          vanId,
          addressLine1: combinedAddressLine1,
          city,
          state,
          zip
        });

        if (duplicate) {
          if (duplicateStrategy === 'error') {
            throw new BadRequestException(`Duplicate address detected for turf "${turfName}"`);
          }

          if (duplicateStrategy === 'merge') {
            await this.prisma.address.update({
              where: { id: duplicate.id },
              data: {
                addressLine1: combinedAddressLine1,
                city,
                state,
                zip: zip ?? duplicate.zip,
                vanId: vanId ?? duplicate.vanId,
                latitude: toOptionalNumber(resolveMappedValue(row, 'latitude', input.mapping)) ?? duplicate.latitude,
                longitude: toOptionalNumber(resolveMappedValue(row, 'longitude', input.mapping)) ?? duplicate.longitude
              }
            });
            duplicateRowsMerged += 1;
            continue;
          }

          duplicateRowsSkipped += 1;
          continue;
        }

        await this.prisma.address.create({
          data: {
            turfId: turf.id,
            organizationId: turf.organizationId,
            campaignId: turf.campaignId,
            addressLine1: combinedAddressLine1,
            city,
            state,
            zip,
            vanId,
            latitude: toOptionalNumber(resolveMappedValue(row, 'latitude', input.mapping)),
            longitude: toOptionalNumber(resolveMappedValue(row, 'longitude', input.mapping))
          }
        });
        addressesImported += 1;
      }
    }

    const result = {
      mode,
      duplicateStrategy,
      turfsCreated: createdTurfs.length,
      addressesImported,
      invalidRowsSkipped,
      duplicateRowsSkipped,
      duplicateRowsMerged,
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
}
