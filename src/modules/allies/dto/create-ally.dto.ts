import {
  IsString, IsOptional, IsBoolean, MinLength, IsNotEmpty, IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAllyDto {
  @ApiPropertyOptional({
    example: 'AL-11-001',
    description: 'Código del aliado. Si no se envía, se genera automáticamente con el formato AL-DIVIPOLA-#consecutivo',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Aliado Ejemplo SAS', description: 'Nombre (razón social)' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'NIT', description: 'Tipo de identificación' })
  @IsNotEmpty()
  @IsString()
  documentType: string;

  @ApiProperty({ example: '900123456', description: 'Número de identificación' })
  @IsNotEmpty()
  @IsString()
  document: string;

  @ApiProperty({ example: '6010000000', description: 'Teléfono' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: 'contacto@aliado.com', description: 'Correo electrónico' })
  @IsNotEmpty()
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ example: '11', description: 'Código DIVIPOLA del departamento' })
  @IsNotEmpty()
  @IsString()
  divipolaCode: string;

  @ApiProperty({ example: 'BOGOTÁ', description: 'Departamento DIVIPOLA' })
  @IsNotEmpty()
  @IsString()
  divipolaDepartment: string;

  @ApiProperty({ example: 'Carlos López', description: 'Contacto (nombres y apellidos)' })
  @IsNotEmpty()
  @IsString()
  contactName: string;

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
