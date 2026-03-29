import { IsString, Length, MinLength } from 'class-validator';

export class DisableMfaDto {
  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
