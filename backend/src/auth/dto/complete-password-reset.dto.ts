import { IsString, MinLength } from 'class-validator';

export class CompletePasswordResetDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(12)
  password!: string;
}
