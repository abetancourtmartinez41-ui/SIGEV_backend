import {
  IsString, IsNumber, IsOptional, Min, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({ example: 'Servicio de consultoría' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tariffId?: string;
}
