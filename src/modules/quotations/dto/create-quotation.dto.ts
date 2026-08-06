import {
  IsString, IsNumber, IsOptional, IsArray, ValidateNested, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class CreateQuotationDto {
  @ApiPropertyOptional({ example: 'COT-2026-001-1', description: 'Código de la cotización. Se autogenera si se omite' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Taller de fortalecimiento' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Alcaldía Municipal' })
  @IsOptional()
  @IsString()
  cliente?: string;

  @ApiProperty({ description: 'ID del evento asociado' })
  @IsString()
  eventId: string;

  @ApiPropertyOptional({ description: 'Aliado (se toma del evento si se omite)' })
  @IsOptional()
  @IsString()
  allyId?: string;

  @ApiPropertyOptional({ default: 'COP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-08-02' })
  @IsOptional()
  @IsString()
  quotationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  validityDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ type: [CreateQuotationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items?: CreateQuotationItemDto[];
}
