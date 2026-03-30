import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpsertSystemSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  authRateLimitWindowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  authRateLimitMaxAttempts?: number;

  @IsOptional()
  @IsBoolean()
  retentionJobEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionJobIntervalMinutes?: number;
}
