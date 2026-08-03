import {
  IsNumber, IsBoolean, IsOptional, IsDate, IsString, Min, Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toOptionalDate = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export class CreateParameterVersionDto {
  @ApiProperty({ example: 0.19 })
  @IsNumber()
  @Min(0)
  @Max(1)
  ivaRate: number;

  @ApiProperty({ example: 0.08 })
  @IsNumber()
  @Min(0)
  @Max(1)
  impuestoConsumoRate: number;

  @ApiProperty({ example: 0.0825 })
  @IsNumber()
  @Min(0)
  @Max(1)
  feeTarifadoRate: number;

  @ApiProperty({ example: 0.0825 })
  @IsNumber()
  @Min(0)
  @Max(1)
  feeTercerosRate: number;

  @ApiProperty({ example: 0.19 })
  @IsNumber()
  @Min(0)
  @Max(1)
  ivaFeeRate: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  applyFeeOnBase?: boolean;

  @ApiProperty({ example: '2026-01-01' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  fechaInicio?: Date;

  @ApiProperty({ example: '2026-12-31' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  fechaFin?: Date;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Admin Funcional' })
  @IsOptional()
  @IsString()
  aprobadoPor?: string;
}
