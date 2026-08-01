import { IsInt, IsNumber, IsOptional, IsIn, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TARIFF_TYPES } from '../../../config/constants';

export class AdjustTariffDto {
  @ApiProperty({ example: 2026, description: 'Vigencia sobre la que se aplica el ajuste' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  vigencyYear: number;

  @ApiProperty({ example: 5.1, description: 'Porcentaje de ajuste anual (ej. IPC 2026 = 5.1%)' })
  @IsNumber()
  @Min(-100)
  @Max(100)
  ipcPercentage: number;

  @ApiProperty({ enum: Object.values(TARIFF_TYPES), required: false })
  @IsOptional()
  @IsIn(Object.values(TARIFF_TYPES))
  tariffType?: string;
}
