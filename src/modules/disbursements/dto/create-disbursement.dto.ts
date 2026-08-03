import {
  IsString, IsNumber, IsOptional, IsDate, IsBoolean, Min, Max, MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toOptionalDate = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export class CreateDisbursementDto {
  @ApiProperty({ example: 'DES-001' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ example: 'Desembolso 2026-01' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 50000000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 2026 })
  @IsNumber()
  @Min(2000)
  year: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentageParticipation?: number;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-08-15' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  disbursementDate?: Date;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-01-01' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  fechaInicio?: Date;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-12-31' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  fechaFin?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
