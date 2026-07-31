import { IsString, IsNumber, IsOptional, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDisbursementDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
