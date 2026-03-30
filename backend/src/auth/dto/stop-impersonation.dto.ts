import { IsOptional, IsUUID } from 'class-validator';

export class StopImpersonationDto {
  @IsOptional()
  @IsUUID()
  sessionId!: string;
}
