import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MunicipalityStatsDto {
  @ApiPropertyOptional({ description: 'Código DIVIPOLA del municipio' })
  @IsOptional()
  @IsString()
  divipolaCode?: string;

  @ApiPropertyOptional({ description: 'ID del aliado' })
  @IsOptional()
  @IsString()
  generalAllyId?: string;

  @ApiPropertyOptional({ description: 'ID del desembolso' })
  @IsOptional()
  @IsString()
  disbursementId?: string;

  @ApiPropertyOptional({ description: 'Estado del evento' })
  @IsOptional()
  @IsString()
  status?: string;
}
