import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '3f3e8e...', nullable: true, description: 'Aliado asociado (null para desasignar)' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  allyId?: string | null;
}
