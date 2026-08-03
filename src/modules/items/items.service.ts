import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateItemDto, UpdateItemDto } from './dto';
import { CalculationsService } from '../calculations/calculations.service';
import { TariffsService } from '../tariffs/tariffs.service';

type EventContext = { id: string; municipalityCategory: string | null; startDate?: Date | null };

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationsService: CalculationsService,
    private readonly tariffsService: TariffsService,
  ) {}

  private async resolveItemValues(
    dto: {
      name?: string;
      description?: string;
      unitPrice?: number;
      tariffId?: string;
      isTariffed?: boolean;
    },
    event: EventContext,
  ): Promise<{
    name: string;
    description?: string;
    unitPrice: number;
    isTariffed: boolean;
    tariffId?: string;
  }> {
    let name = dto.name;
    let description = dto.description;
    let unitPrice = dto.unitPrice ?? 0;
    let isTariffed = dto.isTariffed ?? false;
    let tariffId = dto.tariffId;

    if (dto.tariffId) {
      const resolved = await this.tariffsService.resolveTariffItem(
        dto.tariffId,
        event.municipalityCategory,
        undefined,
        event.startDate ?? null,
      );
      unitPrice = Number(resolved.unitPrice);
      name = resolved.name;
      if (!description) {
        description = resolved.description ?? undefined;
      }
      isTariffed = true;
    } else if (dto.unitPrice === undefined) {
      throw new BadRequestException(
        'Los servicios NO_TARIFADO requieren un valor unitario manual',
      );
    }

    if (!name) {
      throw new BadRequestException('El ítem requiere un nombre o un servicio del tarifario');
    }

    return { name, description, unitPrice, isTariffed, tariffId };
  }

  async buildItemData(
    dto: CreateItemDto,
    event: EventContext,
  ): Promise<Prisma.ItemUncheckedCreateInput> {
    const resolved = await this.resolveItemValues(dto, event);
    const rates = await this.calculationsService.getActiveRates();
    const calculated = this.calculationsService.calculateItem({
      name: resolved.name,
      description: resolved.description,
      quantity: dto.quantity,
      unitPrice: resolved.unitPrice,
      ivaRate: dto.ivaRate ?? rates.ivaRate,
      consumptionTaxRate: dto.consumptionTaxRate ?? rates.consumptionTaxRate,
      feeRate: dto.feeRate ?? rates.feeRate,
      feeIvaRate: dto.feeIvaRate ?? rates.feeIvaRate,
      feeApplyOn: rates.feeApplyOn,
      allyId: dto.allyId,
      tariffId: resolved.tariffId,
    });
    return {
      ...calculated,
      isTariffed: resolved.isTariffed,
      eventId: event.id,
    } as Prisma.ItemUncheckedCreateInput;
  }

  async create(dto: CreateItemDto): Promise<Prisma.ItemGetPayload<{}>> {
    if (!dto.eventId) {
      throw new BadRequestException('Debe especificar el evento al que pertenece el ítem');
    }
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    const itemData = await this.buildItemData(dto, event);
    return this.prisma.item.create({ data: itemData });
  }

  async findAll(): Promise<Prisma.ItemGetPayload<{}>[]> {
    return this.prisma.item.findMany({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<Prisma.ItemGetPayload<{}>> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    return item;
  }

  async update(id: string, dto: UpdateItemDto): Promise<Prisma.ItemGetPayload<{}>> {
    const item = await this.findOne(id);
    const event = await this.prisma.event.findUnique({ where: { id: item.eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const merged: CreateItemDto = {
      ...item,
      ...dto,
      unitPrice: dto.unitPrice ?? Number(item.unitPrice),
    } as unknown as CreateItemDto;

    const resolved = await this.resolveItemValues(merged, event);
    const rates = await this.calculationsService.getActiveRates();
    const calculated = this.calculationsService.calculateItem({
      name: resolved.name,
      description: resolved.description,
      quantity: merged.quantity,
      unitPrice: resolved.unitPrice,
      ivaRate: merged.ivaRate ?? rates.ivaRate,
      consumptionTaxRate: merged.consumptionTaxRate ?? rates.consumptionTaxRate,
      feeRate: merged.feeRate ?? rates.feeRate,
      feeIvaRate: merged.feeIvaRate ?? rates.feeIvaRate,
      feeApplyOn: rates.feeApplyOn,
      allyId: merged.allyId,
      tariffId: resolved.tariffId,
    });
    return this.prisma.item.update({
      where: { id },
      data: { ...calculated, isTariffed: resolved.isTariffed },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.item.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
