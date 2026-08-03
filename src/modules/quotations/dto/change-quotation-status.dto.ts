import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeQuotationStatusDto {
  @ApiProperty({ example: 'Aprobada', enum: ['Borrador', 'Enviada', 'Aprobada', 'Rechazada'] })
  @IsString()
  @MinLength(1)
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observation?: string;
}
