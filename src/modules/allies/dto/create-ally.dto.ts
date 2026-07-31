import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAllyDto {
  @ApiProperty({ example: 'Aliado Ejemplo SAS' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '900123456' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: 'Carlos López' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: 'carlos@aliado.com' })
  @IsOptional()
  @IsString()
  contactEmail?: string;
}
