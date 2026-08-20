import {
  IsString, IsOptional, IsArray, ValidateNested, MinLength, IsUUID, IsInt, Min, IsNumber, IsIn, IsNotEmpty,
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

  @ApiPropertyOptional({ description: 'Esquema de presentación (cotizacion | detalle)', enum: ['cotizacion', 'detalle'] })
  @IsOptional()
  @IsIn(['cotizacion', 'detalle'])
  schemaType?: 'cotizacion' | 'detalle';

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

  @ApiPropertyOptional({ description: 'Recurso disponible asignado al evento' })
  @IsOptional()
  @IsString()
  @IsUUID()
  disbursementId?: string;

  @ApiProperty({ description: 'Fecha del evento. Formato ISO o YYYY-MM-DD' })
  @IsString()
  @IsNotEmpty()
  startDate: string;

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

  @ApiPropertyOptional({ description: 'Latitud de las coordenadas del evento' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitud de las coordenadas del evento' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ type: [CreateItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items?: CreateItemDto[];

  @ApiPropertyOptional({ description: 'Programa al que pertenece el evento', enum: ['RENHACEMOS', 'PNIS', 'OTROS'] })
  @IsOptional()
  @IsString()
  programa?: string;

  @ApiPropertyOptional({ description: 'Instancia de participación según el programa' })
  @IsOptional()
  @IsString()
  instanciaParticipacion?: string;
}
