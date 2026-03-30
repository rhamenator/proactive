import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpsertOperationalPolicyDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @IsOptional()
  @IsIn(['create_only', 'upsert', 'replace_turf_membership'])
  defaultImportMode?: 'create_only' | 'upsert' | 'replace_turf_membership';

  @IsOptional()
  @IsIn(['skip', 'error', 'merge', 'review'])
  defaultDuplicateStrategy?: 'skip' | 'error' | 'merge' | 'review';

  @IsOptional()
  @IsInt()
  @Min(1)
  sensitiveMfaWindowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionArchiveDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionPurgeDays?: number | null;

  @IsOptional()
  @IsBoolean()
  requireArchiveReason?: boolean;

  @IsOptional()
  @IsBoolean()
  allowOrgOutcomeFallback?: boolean;
}
