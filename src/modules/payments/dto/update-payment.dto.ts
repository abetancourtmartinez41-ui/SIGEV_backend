import {
  IsString, IsNumber, IsOptional, IsDate, Min, IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAYMENT_TYPES, PAYMENT_STATUS } from './create-payment.dto';

const toOptionalDate = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

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

  @ApiPropertyOptional({ enum: PAYMENT_TYPES })
  @IsOptional()
  @IsIn(PAYMENT_TYPES)
  type?: string;

  @ApiPropertyOptional({ enum: PAYMENT_STATUS })
  @IsOptional()
  @IsIn(PAYMENT_STATUS)
  status?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  paymentDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
