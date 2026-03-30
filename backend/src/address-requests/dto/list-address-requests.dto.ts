import { Type } from 'class-transformer';
import { AddressRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, Max, Min } from 'class-validator';

export class ListAddressRequestsDto {
  @IsOptional()
  @IsEnum(AddressRequestStatus)
  status?: AddressRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  take?: number;
}
