import {
  IsString, IsOptional, IsArray, ValidateNested, MinLength, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateItemDto } from '../../items/dto';

export class CreateEventDto {
  @ApiProperty({ example: 'EVT-2026-001' })
  @IsString()
  @MinLength(3)
  code: string;

  @ApiProperty({ example: 'Evento de prueba' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  divipolaCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipalityName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipalityCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generalAllyId?: string;

  @ApiPropertyOptional({ description: 'Desembolso asignado al evento' })
  @IsOptional()
  @IsString()
  @IsUUID()
  disbursementId?: string;

  @ApiPropertyOptional({ type: [CreateItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items?: CreateItemDto[];
}
