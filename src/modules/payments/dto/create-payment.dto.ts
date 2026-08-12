import {
  IsString, IsNumber, IsOptional, IsDate, Min, MinLength, IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PAYMENT_TYPES = ['Anticipo', 'Parcial', 'Final'] as const;

export const PAYMENT_STATUS = ['Registrado', 'Conciliado', 'Anulado'] as const;

const toOptionalDate = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-del-evento' })
  @IsString()
  @MinLength(1)
  eventId: string;

  @ApiPropertyOptional({ example: 'uuid-del-recurso' })
  @IsOptional()
  @IsString()
  disbursementId?: string;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PAYMENT_TYPES, example: 'Parcial' })
  @IsIn(PAYMENT_TYPES)
  type: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-08-20' })
  @IsOptional()
  @IsDate()
  @Transform(toOptionalDate)
  paymentDate?: Date;

  @ApiPropertyOptional({ example: 'Primer desembolso por montaje' })
  @IsOptional()
  @IsString()
  description?: string;
}
