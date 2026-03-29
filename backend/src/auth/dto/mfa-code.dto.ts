import { IsString, Length, MinLength } from 'class-validator';

export class MfaCodeDto {
  @IsString()
  @MinLength(16)
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
