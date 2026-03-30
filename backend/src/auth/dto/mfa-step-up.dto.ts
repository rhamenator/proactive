import { IsString, MinLength } from 'class-validator';

export class MfaStepUpDto {
  @IsString()
  @MinLength(6)
  code!: string;
}
