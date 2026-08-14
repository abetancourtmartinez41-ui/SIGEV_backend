import {
  IsString, IsNumber, IsOptional, Min, IsIn, IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PAYMENT_STATUS,
  PAYMENT_METHODS,
} from './create-payment.dto';

export class UpdatePaymentDto {
  @ApiPropertyOptional({ example: 'uuid-del-recurso' })
  @IsOptional()
  @IsString()
  disbursementId?: string;

  @ApiPropertyOptional({ example: 6000000 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ enum: PAYMENT_STATUS })
  @IsOptional()
  @IsIn(PAYMENT_STATUS)
  status?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  esAdicional?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
