import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTurfDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsString()
  regionCode?: string;
}
