import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsIn } from 'class-validator';

export class ImportCsvDto {
  @IsOptional()
  @IsString()
  turfName?: string;

  @IsOptional()
  @IsString()
  mapping?: string;

  @IsOptional()
  @IsString()
  profileCode?: string;

  @IsOptional()
  @IsIn(['create_only', 'upsert', 'replace_turf_membership'])
  mode?: 'create_only' | 'upsert' | 'replace_turf_membership';

  @IsOptional()
  @IsIn(['skip', 'error', 'merge', 'review'])
  duplicateStrategy?: 'skip' | 'error' | 'merge' | 'review';

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsString()
  regionCode?: string;
}
