import { IsString, Length } from 'class-validator';

export class RunRetentionCleanupDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}
