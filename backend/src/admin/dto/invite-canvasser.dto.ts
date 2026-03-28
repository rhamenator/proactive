import { IsEmail, IsString, MinLength } from 'class-validator';

export class InviteCanvasserDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;
}
