import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryAuditLogDto {
  @ApiPropertyOptional({ description: 'Página (base 1)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  page?: number;

  @ApiPropertyOptional({ description: 'Registros por página', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Búsqueda global (correo, id de entidad, entidad o acción)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Entidad(es) separadas por coma (events, offers, items, allies, users, params, municipalities, disbursements)' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ description: 'Acción: Creación | Actualización | Eliminación | Cambio de estado' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Columna de orden: fecha | usuario | accion | entidad | entidadId | detalle' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Dirección del orden: asc | desc', example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
