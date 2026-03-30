import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CorrectVisitDto {
  @IsString()
  outcomeCode!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
