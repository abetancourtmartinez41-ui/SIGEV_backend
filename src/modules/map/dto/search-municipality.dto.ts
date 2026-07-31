import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchMunicipalityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  divipolaCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;
}
