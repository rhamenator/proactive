import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveImportReviewDto {
  @IsIn(['merge', 'skip'])
  action!: 'merge' | 'skip';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
