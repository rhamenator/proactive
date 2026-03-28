import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReassignTurfDto {
  @IsUUID()
  canvasserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
