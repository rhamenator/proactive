import { IsOptional, IsString } from 'class-validator';

export class ImportCsvDto {
  @IsOptional()
  @IsString()
  turfName?: string;

  @IsOptional()
  @IsString()
  mapping?: string;
}
