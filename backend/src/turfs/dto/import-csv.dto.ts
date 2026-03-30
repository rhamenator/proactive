import { IsOptional, IsString } from 'class-validator';
import { IsIn } from 'class-validator';

export class ImportCsvDto {
  @IsOptional()
  @IsString()
  turfName?: string;

  @IsOptional()
  @IsString()
  mapping?: string;

  @IsOptional()
  @IsIn(['create_only', 'upsert'])
  mode?: 'create_only' | 'upsert';

  @IsOptional()
  @IsIn(['skip', 'error', 'merge'])
  duplicateStrategy?: 'skip' | 'error' | 'merge';
}
