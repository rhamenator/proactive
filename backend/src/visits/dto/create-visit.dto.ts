import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
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
  @Transform(({ value }) => (value === null || value === undefined || value === '' ? undefined : Number(value)))
  latitude?: number;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined || value === '' ? undefined : Number(value)))
  longitude?: number;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  accuracyMeters?: number;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  localRecordUuid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @IsOptional()
  @IsDateString()
  clientCreatedAt?: string;
}
