import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListImportReviewQueueDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}
