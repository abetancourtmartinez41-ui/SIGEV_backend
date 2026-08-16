import {
  IsString, IsNumber, IsOptional, IsBoolean, Min, MinLength, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuotationItemDto {
  @ApiPropertyOptional({
    description: 'Ítem de la orden (requerimiento) que dio origen a este ítem de cotización',
  })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({
    description: 'Descripción del ítem. Se completa automáticamente desde el tarifario si se envía tariffId',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    example: 12000,
    description: 'Valor unitario manual (solo para ítems NO_TARIFADO; se bloquea si hay tariffId)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Servicio del tarifario (usa el precio según la categoría del municipio)' })
  @IsOptional()
  @IsString()
  tariffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTariffed?: boolean;

  @ApiPropertyOptional({ example: 0.19 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ivaRate?: number;

  @ApiPropertyOptional({ example: 0.08 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consumptionTaxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeIvaRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allyId?: string;
}
