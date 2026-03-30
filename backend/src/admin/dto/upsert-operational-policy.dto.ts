import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpsertOperationalPolicyDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @IsOptional()
  @IsIn(['create_only', 'upsert'])
  defaultImportMode?: 'create_only' | 'upsert';

  @IsOptional()
  @IsIn(['skip', 'error', 'merge'])
  defaultDuplicateStrategy?: 'skip' | 'error' | 'merge';

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
