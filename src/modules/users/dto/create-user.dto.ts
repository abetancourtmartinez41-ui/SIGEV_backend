import {
  IsString, IsEmail, IsOptional, IsArray, MinLength, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_TYPES } from '../../../config/constants';

export class CreateUserDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  @MinLength(5)
  document: string;

  @ApiProperty({ example: 'CC' })
  @IsString()
  @IsIn(DOCUMENT_TYPES as unknown as string[])
  documentType: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(3)
  fullName: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: ['admin'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
