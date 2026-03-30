import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAddressRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
