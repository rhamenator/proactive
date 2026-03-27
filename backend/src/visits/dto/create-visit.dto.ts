import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength
} from 'class-validator';
import { VisitResult } from '@prisma/client';

export class CreateVisitDto {
  @IsUUID()
  addressId!: string;

  @IsEnum(VisitResult)
  result!: VisitResult;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  contactMade?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;
}
