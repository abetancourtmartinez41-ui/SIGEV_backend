import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  MinLength,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PAYMENT_STATUS = ['Registrado', 'Conciliado', 'Anulado'] as const;

export const PAYMENT_METHODS = ['por_item', 'prorrateo'] as const;

export class PaymentItemDto {
  @ApiProperty({ example: 'uuid-del-item' })
  @IsString()
  @MinLength(1)
  itemId: string;

  @ApiProperty({ example: 2500000, description: 'Monto a reconocer sobre el ítem' })
  @IsNumber()
  @Min(0.01)
  amount: number;
}

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

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'por_item' })
  @IsIn(PAYMENT_METHODS)
  method: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Pago adicional registrado al cierre del evento',
  })
  @IsOptional()
  @IsBoolean()
  esAdicional?: boolean;

  @ApiPropertyOptional({
    type: [PaymentItemDto],
    description:
      'Ítems cubiertos. Obligatorio en modalidad por_item; en prorrateo opcional (se reparten todos los ítems activos)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items?: PaymentItemDto[];

  @ApiProperty({
    example: 'uuid-del-adjunto-soporte',
    description: 'Soporte documental del pago (obligatorio)',
  })
  @IsString()
  @MinLength(1)
  attachmentId: string;

  @ApiPropertyOptional({ example: 'Primer desembolso por montaje' })
  @IsOptional()
  @IsString()
  description?: string;
}
