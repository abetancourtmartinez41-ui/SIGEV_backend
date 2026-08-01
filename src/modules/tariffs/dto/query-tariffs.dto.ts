import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryTariffsDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o código' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Hoja/Categoría (ej. Alimentación, Transporte)' })
  @IsOptional()
  @IsString()
  sheet?: string;

  @ApiPropertyOptional({ description: 'Tipo de servicio: TARIFADO | NO_TARIFADO' })
  @IsOptional()
  @IsString()
  tariffType?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  vigencyYear?: number;

  @ApiPropertyOptional({ description: 'Incluir servicios inactivos (solo Admin. Funcional)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  includeInactive?: boolean;
}
