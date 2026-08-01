import {
  IsString, IsNumber, IsOptional, IsIn, IsInt, Min, MinLength, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_VIGENCY_YEAR, TARIFF_TYPES } from '../../../config/constants';

export class CreateTariffDto {
  @ApiPropertyOptional({ example: 'ALM-D-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Desayuno básico' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({ example: 'Servicio de alimentación tipo desayuno' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Unidad' })
  @IsOptional()
  @IsString()
  unitMeasure?: string;

  @ApiPropertyOptional({ example: '1 DÍA' })
  @IsOptional()
  @IsString()
  timeUnit?: string;

  @ApiPropertyOptional({ example: 'Valor por persona por turno' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ example: 'Alimentación' })
  @IsOptional()
  @IsString()
  sheet?: string;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceEspecialPrimera?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceSegundaCuarta?: number;

  @ApiPropertyOptional({ example: 9000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceQuintaSexta?: number;

  @ApiPropertyOptional({ enum: Object.values(TARIFF_TYPES), default: TARIFF_TYPES.TARIFADO })
  @IsOptional()
  @IsIn(Object.values(TARIFF_TYPES))
  tariffType?: string;

  @ApiPropertyOptional({ example: DEFAULT_VIGENCY_YEAR, default: DEFAULT_VIGENCY_YEAR })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  vigencyYear?: number;
}
