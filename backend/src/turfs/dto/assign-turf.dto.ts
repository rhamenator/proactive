import { IsUUID } from 'class-validator';

export class AssignTurfDto {
  @IsUUID()
  canvasserId!: string;
}
