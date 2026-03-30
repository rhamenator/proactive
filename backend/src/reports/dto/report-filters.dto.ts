import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const syncStatuses = ['pending', 'syncing', 'synced', 'failed', 'conflict'] as const;
const gpsStatuses = ['verified', 'flagged', 'missing', 'low_accuracy'] as const;

function emptyToUndefined(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value;
}

function fromAliases(value: unknown, obj: Record<string, unknown>, ...aliases: string[]) {
  if (value !== undefined && value !== null && value !== '') {
    return value;
  }

  for (const alias of aliases) {
    const aliasValue = obj[alias];
    if (aliasValue !== undefined && aliasValue !== null && aliasValue !== '') {
      return aliasValue;
    }
  }

  return undefined;
}

export class ReportFiltersDto {
  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'date_from')))
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'date_to')))
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'turf_id')))
  @IsUUID()
  turfId?: string;

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'canvasser_id')))
  @IsUUID()
  canvasserId?: string;

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'campaign_id')))
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'sync_status')))
  @IsIn(syncStatuses)
  syncStatus?: (typeof syncStatuses)[number];

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'gps_status')))
  @IsIn(gpsStatuses)
  gpsStatus?: (typeof gpsStatuses)[number];

  @IsOptional()
  @Transform(({ value, obj }) => emptyToUndefined(fromAliases(value, obj, 'outcome_code')))
  @IsString()
  outcomeCode?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const resolved = emptyToUndefined(fromAliases(value, obj, 'override_flag'));
    if (resolved === undefined) {
      return undefined;
    }
    if (typeof resolved === 'boolean') {
      return resolved;
    }
    return String(resolved).toLowerCase() === 'true';
  })
  @IsBoolean()
  overrideFlag?: boolean;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const resolved = fromAliases(value, obj, 'limit');
    if (resolved === undefined) {
      return undefined;
    }

    return Number(resolved);
  })
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
