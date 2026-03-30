import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartImpersonationDto {
  @IsUUID()
  targetUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
