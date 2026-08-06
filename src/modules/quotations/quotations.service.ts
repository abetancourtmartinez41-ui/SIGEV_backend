import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UserWithRoles } from '../../database/types';
import {
  CreateQuotationDto, UpdateQuotationDto, ChangeQuotationStatusDto, CreateQuotationItemDto,
} from './dto';
import { CalculationsService } from '../calculations/calculations.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { ReportsService } from '../reports/reports.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ROLES } from '../../config/constants';

const quotationInclude = {
  event: { include: { disbursement: true } },
  ally: true,
  createdBy: true,
  items: { where: { isActive: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

type QuotationWithRelations = Prisma.QuotationGetPayload<{ include: typeof quotationInclude }>;

export const QUOTATION_STATUS = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
} as const;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationsService: CalculationsService,
    private readonly tariffsService: TariffsService,
    private readonly reportsService: ReportsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  private roleNames(roles: { name: string }[]): string[] {
    return roles.map((role) => role.name);
  }

  private isOperator(user: { roles: { name: string }[] }): boolean {
    return this.roleNames(user.roles).includes(ROLES.OPERATOR);
  }

  private assertAllyScope(
    event: { generalAllyId: string | null },
    user: { allyId?: string | null; roles: { name: string }[] },
  ): void {
    if (!this.isOperator(user)) return;
    if (event.generalAllyId && event.generalAllyId === user.allyId) return;
    throw new ForbiddenException(
      'Esta oferta pertenece a un evento de otro Aliado y su perfil solo gestiona eventos de su Aliado asignado',
    );
  }

  private async resolveItemValues(
    dto: {
      description?: string;
      unitPrice?: number;
      tariffId?: string;
      isTariffed?: boolean;
    },
    event: { municipalityCategory: string | null; startDate?: Date | null },
  ): Promise<{
    description: string;
    unitPrice: number;
    isTariffed: boolean;
    tariffId?: string;
  }> {
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
      if (!description) {
        description = resolved.name;
      }
      isTariffed = true;
    } else if (dto.unitPrice === undefined) {
      throw new BadRequestException(
        'Los ítems NO_TARIFADO requieren un valor unitario manual',
      );
    }

    if (!description) {
      throw new BadRequestException(
        'El ítem de la oferta requiere una descripción o un servicio del tarifario',
      );
    }

    return { description, unitPrice, isTariffed, tariffId };
  }

  private async computeItemData(
    dto: CreateQuotationItemDto,
    event: { municipalityCategory: string | null; startDate?: Date | null },
  ): Promise<Omit<Prisma.QuotationItemUncheckedCreateInput, 'quotationId'>> {
    const resolved = await this.resolveItemValues(dto, event);
    const rates = await this.calculationsService.getActiveRates();
    const calculated = this.calculationsService.calculateItem({
      name: resolved.description,
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
      description: resolved.description,
      quantity: dto.quantity,
      unitPrice: calculated.unitPrice,
      ivaRate: calculated.ivaRate,
      ivaValue: calculated.ivaValue,
      consumptionTaxRate: calculated.consumptionTaxRate,
      consumptionTaxValue: calculated.consumptionTaxValue,
      feeRate: calculated.feeRate,
      feeValue: calculated.feeValue,
      feeIvaRate: calculated.feeIvaRate,
      feeIvaValue: calculated.feeIvaValue,
      totalValue: calculated.totalValue,
      allyId: dto.allyId,
      tariffId: resolved.tariffId,
      isTariffed: resolved.isTariffed,
    };
  }

  private async resolveEvent(id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  private async generateCode(event: { id: string; code: string; suffix: string }): Promise<string> {
    const count = await this.prisma.quotation.count({ where: { eventId: event.id } });
    const base = event.code + (event.suffix ? `-${event.suffix}` : '');
    return `COT-${base}-${count + 1}`;
  }

  async create(dto: CreateQuotationDto, user: UserWithRoles): Promise<QuotationWithRelations> {
    const event = await this.resolveEvent(dto.eventId);
    this.assertAllyScope(event, user);
    const code = dto.code?.trim() || (await this.generateCode(event));

    const itemData: Omit<Prisma.QuotationItemUncheckedCreateInput, 'quotationId'>[] = [];
    for (const itemDto of dto.items ?? []) {
      itemData.push(await this.computeItemData(itemDto, event));
    }
    const amount = itemData.reduce((sum, item) => sum + Number(item.totalValue), 0);

    const saved = await this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          code,
          name: dto.name,
          description: dto.description,
          cliente: dto.cliente,
          eventId: event.id,
          allyId: dto.allyId ?? event.generalAllyId,
          amount,
          currency: dto.currency ?? 'COP',
          quotationDate: dto.quotationDate ? new Date(dto.quotationDate) : null,
          validityDays: dto.validityDays,
          status: QUOTATION_STATUS.BORRADOR,
          observations: dto.observations,
          createdById: user.id,
        },
      });
      if (itemData.length) {
        await tx.quotationItem.createMany({
          data: itemData.map((item) => ({ ...item, quotationId: quotation.id })),
        });
      }
      return quotation;
    });

    return this.findOne(saved.id);
  }

  async findAll(user?: { allyId?: string | null; roles: { name: string }[] }): Promise<QuotationWithRelations[]> {
    const where: Prisma.QuotationWhereInput = { isActive: true };
    if (user && this.isOperator(user)) {
      if (user.allyId) {
        where.event = { generalAllyId: user.allyId };
      } else {
        where.id = { in: [] };
      }
    }
    return this.prisma.quotation.findMany({
      where,
      include: quotationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<QuotationWithRelations> {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, isActive: true },
      include: quotationInclude,
    });
    if (!quotation) throw new NotFoundException('Oferta no encontrada');
    return quotation;
  }

  async update(
    id: string,
    dto: UpdateQuotationDto,
    user: UserWithRoles,
  ): Promise<QuotationWithRelations> {
    const quotation = await this.findOne(id);
    const event = await this.resolveEvent(dto.eventId ?? quotation.eventId);
    this.assertAllyScope(event, user);

    const { items, ...data } = dto as UpdateQuotationDto & { items?: CreateQuotationItemDto[] };

    let amount = Number(quotation.amount);
    let itemData: Omit<Prisma.QuotationItemUncheckedCreateInput, 'quotationId'>[] | undefined;
    if (items) {
      itemData = [];
      for (const itemDto of items) {
        itemData.push(await this.computeItemData(itemDto, event));
      }
      amount = itemData.reduce((sum, item) => sum + Number(item.totalValue), 0);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id },
        data: {
          ...(data.code !== undefined ? { code: data.code } : {}),
          name: data.name,
          description: data.description,
          cliente: data.cliente,
          eventId: dto.eventId ?? quotation.eventId,
          allyId: data.allyId ?? event.generalAllyId,
          amount,
          currency: data.currency,
          quotationDate:
            data.quotationDate !== undefined
              ? (data.quotationDate ? new Date(data.quotationDate) : null)
              : undefined,
          validityDays: data.validityDays,
          observations: data.observations,
        },
      });

      if (itemData) {
        await tx.quotationItem.updateMany({
          where: { quotationId: id },
          data: { isActive: false },
        });
        if (itemData.length) {
          await tx.quotationItem.createMany({
            data: itemData.map((item) => ({ ...item, quotationId: id })),
          });
        }
      }

      return tx.quotation.findUniqueOrThrow({
        where: { id },
        include: quotationInclude,
      });
    });
  }

  async changeStatus(
    id: string,
    dto: ChangeQuotationStatusDto,
    user: UserWithRoles,
  ): Promise<QuotationWithRelations> {
    const quotation = await this.findOne(id);
    const roles = this.roleNames(user.roles);
    this.assertAllyScope(quotation.event, user);

    const allowedRoles = [ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR, ROLES.APPROVER];
    if (!roles.some((role) => allowedRoles.includes(role as never))) {
      throw new ForbiddenException('Su perfil no puede cambiar el estado de las ofertas');
    }

    if (!(Object.values(QUOTATION_STATUS) as string[]).includes(dto.status)) {
      throw new BadRequestException(`Estado de oferta no válido: ${dto.status}`);
    }

    if (dto.status === QUOTATION_STATUS.APROBADA && !roles.includes(ROLES.APPROVER)) {
      throw new ForbiddenException('Solo el Aprobador puede marcar una oferta como Aprobada');
    }

    const isApproved = dto.status === QUOTATION_STATUS.APROBADA;

    const updated = await this.prisma.$transaction(async (tx) => {
      const quotationUpdate = await tx.quotation.update({
        where: { id },
        data: {
          status: dto.status,
          isDefinitive: isApproved ? true : quotation.isDefinitive,
          ...(dto.observation !== undefined ? { observations: dto.observation } : {}),
        },
        include: quotationInclude,
      });

      if (isApproved && quotation.eventId) {
        await tx.event.updateMany({
          where: { id: quotation.eventId },
          data: { cotizacionSeleccionadaId: quotation.id },
        });
      }

      return quotationUpdate;
    });

    if (isApproved && quotation.eventId) {
      const buffer = await this.reportsService.generateComunicadoAprobacionPdf({
        event: {
          code: quotation.event.code,
          name: quotation.event.name,
          municipalityName: quotation.event.municipalityName ?? null,
          municipalityCategory: quotation.event.municipalityCategory ?? null,
        },
        quotation: {
          code: quotation.code,
          name: quotation.name ?? '',
          cliente: quotation.cliente,
          currency: quotation.currency,
          amount: Number(quotation.amount),
          quotationDate: quotation.quotationDate,
          validityDays: quotation.validityDays,
          ally: quotation.ally ? { name: quotation.ally.name } : null,
          items: quotation.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalValue: Number(item.totalValue),
          })),
        },
        approver: { fullName: user.fullName, email: user.email },
        approvedAt: new Date(),
      });

      await this.attachmentsService.saveGeneratedPdf({
        eventId: quotation.eventId,
        category: 'Comunicado de aprobación',
        fileName: `comunicado-${quotation.code.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
        buffer,
        uploadedById: user.id,
      });
    }

    return updated;
  }

  async select(id: string, user: UserWithRoles): Promise<QuotationWithRelations> {
    const quotation = await this.findOne(id);
    this.assertAllyScope(quotation.event, user);
    if (!quotation.eventId) {
      throw new BadRequestException('La oferta debe estar asociada a un evento');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: { isDefinitive: true },
        include: quotationInclude,
      });
      await tx.event.update({
        where: { id: quotation.eventId },
        data: { cotizacionSeleccionadaId: quotation.id },
      });
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.quotation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
