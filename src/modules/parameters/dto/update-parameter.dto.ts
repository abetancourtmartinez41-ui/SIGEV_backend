import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateParameterDto {
  @ApiPropertyOptional({ example: '0.0825' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: 'Tarifa de fee aplicada al cálculo de ofertas' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
