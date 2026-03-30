import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { SupervisorScopeMode } from '@prisma/client';

export class UpsertOperationalPolicyDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @IsOptional()
  defaultImportProfileCode?: string;

  @IsOptional()
  @IsIn(['create_only', 'upsert', 'replace_turf_membership'])
  defaultImportMode?: 'create_only' | 'upsert' | 'replace_turf_membership';

  @IsOptional()
  @IsIn(['skip', 'error', 'merge', 'review'])
  defaultDuplicateStrategy?: 'skip' | 'error' | 'merge' | 'review';

  @IsOptional()
  defaultVanExportProfileCode?: string;

  @IsOptional()
  defaultInternalExportProfileCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sensitiveMfaWindowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  canvasserCorrectionWindowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttemptsPerHousehold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minMinutesBetweenAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  geofenceRadiusFeet?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  gpsLowAccuracyMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  refreshTokenTtlDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  activationTokenTtlHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  passwordResetTtlMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  loginLockoutThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  loginLockoutMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mfaChallengeTtlMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mfaBackupCodeCount?: number;

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

  @IsOptional()
  @IsEnum(SupervisorScopeMode)
  supervisorScopeMode?: SupervisorScopeMode;
}
