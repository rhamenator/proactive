import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReopenTurfDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
