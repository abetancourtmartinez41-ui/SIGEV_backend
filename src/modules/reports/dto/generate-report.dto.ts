import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ example: 'pdf' })
  @IsString()
  @IsIn(['pdf', 'excel'])
  format: string;

  @ApiProperty({ example: 'offer' })
  @IsString()
  @IsIn(['offer', 'matrix', 'payments', 'resource'])
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disbursementId?: string;
}
