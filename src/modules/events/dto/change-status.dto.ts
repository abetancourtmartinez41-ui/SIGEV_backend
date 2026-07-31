import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EVENT_STATUS } from '../../../config/constants';

export class ChangeStatusDto {
  @ApiProperty({
    enum: Object.values(EVENT_STATUS),
    example: EVENT_STATUS.IN_EXECUTION,
  })
  @IsString()
  @IsIn(Object.values(EVENT_STATUS))
  status: string;
}
