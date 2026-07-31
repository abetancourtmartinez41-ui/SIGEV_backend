import { IsString, IsIn, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EVENT_STATUS } from '../../../config/constants';

export class ChangeStatusDto {
  @ApiProperty({
    enum: Object.values(EVENT_STATUS),
    example: EVENT_STATUS.EN_EJECUCION,
  })
  @IsString()
  @IsIn(Object.values(EVENT_STATUS))
  status: string;

  @ApiPropertyOptional({ example: 'Corregir cuantías de los ítems antes de aprobar' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  observation?: string;

  @ApiPropertyOptional({
    description: 'Autoriza excepción (ej. aprobar con menos de 4 cotizaciones)',
  })
  @IsOptional()
  @IsBoolean()
  authorizeException?: boolean;
}
