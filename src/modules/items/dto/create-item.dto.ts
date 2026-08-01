import {
  IsString, IsNumber, IsOptional, IsBoolean, Min, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiPropertyOptional({
    description: 'ID del evento. Se asigna automáticamente cuando el ítem se crea dentro del evento',
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({
    description: 'Se completa automáticamente desde el tarifario si se envía tariffId',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    example: 12000,
    description: 'Valor unitario manual (solo para servicios NO_TARIFADO; se bloquea si hay tariffId)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Marca el ítem como NO_TARIFADO para que el Aprobador lo revise',
  })
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

  @ApiPropertyOptional({ description: 'Servicio del tarifario (bloquea unitPrice con el precio oficial)' })
  @IsOptional()
  @IsString()
  tariffId?: string;
}
