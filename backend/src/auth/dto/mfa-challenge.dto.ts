import { IsString, MinLength } from 'class-validator';

export class MfaChallengeDto {
  @IsString()
  @MinLength(16)
  challengeToken!: string;
}
