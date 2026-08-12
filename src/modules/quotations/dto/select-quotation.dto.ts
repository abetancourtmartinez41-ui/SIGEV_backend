import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SelectQuotationItemDto {
  @ApiPropertyOptional({ description: 'Ítem de cotización incluido en la oferta económica definitiva' })
  @IsString()
  quotationItemId: string;
}

export class SelectQuotationDto {
  @ApiPropertyOptional({
    description:
      'Ítems seleccionados para componer la oferta definitiva (pueden provenir de distintas cotizaciones del evento). Si se omite, se usan todos los ítems de la cotización validada.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectQuotationItemDto)
  items?: SelectQuotationItemDto[];
}
