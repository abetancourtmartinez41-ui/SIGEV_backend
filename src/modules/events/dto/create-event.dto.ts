import {
  IsString, IsOptional, IsArray, ValidateNested, MinLength, IsUUID, IsInt, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateItemDto } from '../../items/dto';

export class CreateEventDto {
  @ApiProperty({ example: 'EVT-2026-001' })
  @IsString()
  @MinLength(3)
  code: string;

  @ApiPropertyOptional({ description: 'Sufijo de la orden (Ej: A, B, C)' })
  @IsOptional()
  @IsString()
  suffix?: string;

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

  @ApiPropertyOptional({ description: 'Fecha del evento. Formato ISO o YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Dependencia del responsable' })
  @IsOptional()
  @IsString()
  dependency?: string;

  @ApiPropertyOptional({ description: 'Vereda del evento' })
  @IsOptional()
  @IsString()
  hamlet?: string;

  @ApiPropertyOptional({ description: 'Cantidad de asistentes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  attendees?: number;

  @ApiPropertyOptional({ description: 'Duración del evento en días' })
  @IsOptional()
  @IsInt()
  @Min(0)
  days?: number;

  @ApiPropertyOptional({ type: [CreateItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items?: CreateItemDto[];
}
