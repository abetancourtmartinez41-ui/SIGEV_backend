import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UserWithRoles } from '../../database/types';
import {
  CreateQuotationDto, UpdateQuotationDto, ChangeQuotationStatusDto, CreateQuotationItemDto,
  SelectQuotationDto,
} from './dto';
import { CalculationsService } from '../calculations/calculations.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { ReportsService } from '../reports/reports.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { OfertaEconomicaService } from '../oferta-economica/oferta-economica.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ROLES, EVENT_STATUS } from '../../config/constants';

const quotationInclude = {
  event: { include: { disbursement: true } },
  ally: true,
  createdBy: true,
  validadaPor: true,
  aprobadaPor: true,
  items: { where: { isActive: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

type QuotationWithRelations = Prisma.QuotationGetPayload<{ include: typeof quotationInclude }>;

export const QUOTATION_STATUS = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  VALIDADA: 'Validada',
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
    private readonly ofertaEconomicaService: OfertaEconomicaService,
    private readonly notificationsService: NotificationsService,
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
      'Esta cotización pertenece a un evento de otro Aliado y su perfil solo gestiona eventos de su Aliado asignado',
    );
  }

  private assertEventNotRejected(event: { status: string }): void {
    if (event.status === EVENT_STATUS.RECHAZADO) {
      throw new BadRequestException(
        'La orden fue rechazada y su proceso está detenido; no se pueden modificar sus cotizaciones',
      );
    }
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
        'El ítem de la cotización requiere una descripción o un servicio del tarifario',
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
    const baseValue = dto.quantity * resolved.unitPrice;
    return {
      description: resolved.description,
      quantity: dto.quantity,
      unitPrice: resolved.unitPrice,
      ivaRate: dto.ivaRate ?? rates.ivaRate,
      ivaValue: 0,
      consumptionTaxRate: dto.consumptionTaxRate ?? rates.consumptionTaxRate,
      consumptionTaxValue: 0,
      feeRate: dto.feeRate ?? rates.feeRate,
      feeValue: 0,
      feeIvaRate: dto.feeIvaRate ?? rates.feeIvaRate,
      feeIvaValue: 0,
      totalValue: baseValue,
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
    this.assertEventNotRejected(event);
    if (event.cotizacionSeleccionadaId) {
      throw new BadRequestException(
        'La cotización de este evento ya fue aprobada; no se pueden crear nuevas cotizaciones',
      );
    }
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

    const approverIds = await this.notificationsService.findUserIdsByRoles([
      ROLES.APPROVER,
      ROLES.FUNCTIONAL_ADMIN,
      ROLES.SUPERVISOR,
    ]);
    await this.notificationsService.createMany(approverIds, {
      eventId: event.id,
      type: 'QUOTATION_CREATED',
      message: `Nueva cotización ${code} registrada para el evento ${event.name}. Pendiente de validación.`,
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
    if (!quotation) throw new NotFoundException('Cotización no encontrada');
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
    this.assertEventNotRejected(event);

    if (quotation.isDefinitive || event.cotizacionSeleccionadaId) {
      throw new BadRequestException(
        'La cotización ya fue aprobada; no puede modificarse',
      );
    }

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
    this.assertEventNotRejected(quotation.event);

    const allowedRoles = [ROLES.APPROVER];
    if (!roles.some((role) => allowedRoles.includes(role as never))) {
      throw new ForbiddenException('Solo el Aprobador puede aprobar o rechazar cotizaciones');
    }

    if (!(Object.values(QUOTATION_STATUS) as string[]).includes(dto.status)) {
      throw new BadRequestException(`Estado de cotización no válido: ${dto.status}`);
    }

    if (dto.status === QUOTATION_STATUS.APROBADA && !roles.includes(ROLES.APPROVER)) {
      throw new ForbiddenException('Solo el Aprobador puede marcar una cotización como Aprobada');
    }

    const isApproved = dto.status === QUOTATION_STATUS.APROBADA;

    if (
      isApproved &&
      quotation.event.cotizacionSeleccionadaId &&
      quotation.event.cotizacionSeleccionadaId !== quotation.id
    ) {
      throw new BadRequestException(
        'Ya existe una cotización aprobada para este evento; no se puede aprobar otra',
      );
    }

    if (isApproved) {
      this.assertSecondApprover(quotation, user);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const quotationUpdate = await tx.quotation.update({
        where: { id },
        data: {
          status: dto.status,
          isDefinitive: isApproved ? true : quotation.isDefinitive,
          aprobadaPorId: isApproved ? user.id : undefined,
          aprobadaEn: isApproved ? new Date() : undefined,
          ...(dto.observation !== undefined ? { observations: dto.observation } : {}),
        },
        include: quotationInclude,
      });

      if (isApproved && quotation.eventId) {
        await tx.event.updateMany({
          where: { id: quotation.eventId },
          data: {
            cotizacionSeleccionadaId: quotation.id,
            ...(quotation.event.status === EVENT_STATUS.ABIERTO ||
            quotation.event.status === EVENT_STATUS.DEVUELTO
              ? { status: EVENT_STATUS.EN_EJECUCION }
              : {}),
          },
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

      await this.ofertaEconomicaService.ensureFromQuotation(quotation, user);

      await this.notifyApproved(quotation);
    }

    return updated;
  }

  private assertSecondApprover(
    quotation: { validadaPorId: string | null },
    user: { id: string },
  ): void {
    if (!quotation.validadaPorId) {
      throw new BadRequestException(
        'La cotización debe ser validada primero por un Aprobador distinto',
      );
    }
    if (quotation.validadaPorId === user.id) {
      throw new ForbiddenException(
        'El Aprobador que validó la cotización no puede ejecutar la aprobación definitiva; se requiere un segundo Aprobador',
      );
    }
  }

  private async notifyApproved(quotation: QuotationWithRelations): Promise<void> {
    const event = quotation.event;
    const operatorIds = await this.notificationsService.findOperatorUserIdsForAlly(
      event.generalAllyId,
    );
    await this.notificationsService.createMany([event.createdById, ...operatorIds], {
      eventId: event.id,
      type: 'QUOTATION_APPROVED',
      message: `La cotización ${quotation.code} fue aprobada como definitiva; se generó la oferta económica del evento ${event.name}.`,
    });
  }

  async validate(id: string, user: UserWithRoles): Promise<QuotationWithRelations> {
    const quotation = await this.findOne(id);
    const roles = this.roleNames(user.roles);
    if (!roles.includes(ROLES.APPROVER)) {
      throw new ForbiddenException('Solo el Aprobador puede validar cotizaciones');
    }
    this.assertAllyScope(quotation.event, user);
    this.assertEventNotRejected(quotation.event);

    if (quotation.isDefinitive || quotation.event.cotizacionSeleccionadaId) {
      throw new BadRequestException(
        'La cotización del evento ya fue aprobada de forma definitiva; no se puede validar otra',
      );
    }
    if (quotation.validadaPorId) {
      throw new BadRequestException('La cotización ya fue validada');
    }
    const otherValidated = await this.prisma.quotation.findFirst({
      where: {
        eventId: quotation.eventId,
        id: { not: id },
        status: QUOTATION_STATUS.VALIDADA,
        isActive: true,
      },
      select: { id: true },
    });
    if (otherValidated) {
      throw new BadRequestException(
        'Ya existe una cotización en validación para este evento; valide únicamente la ganadora',
      );
    }

    return this.prisma.quotation.update({
      where: { id },
      data: {
        status: QUOTATION_STATUS.VALIDADA,
        validadaPorId: user.id,
        validadaEn: new Date(),
      },
      include: quotationInclude,
    });
  }

  async select(id: string, dto: SelectQuotationDto, user: UserWithRoles): Promise<QuotationWithRelations> {
    const quotation = await this.findOne(id);
    this.assertAllyScope(quotation.event, user);
    this.assertEventNotRejected(quotation.event);
    if (!quotation.eventId) {
      throw new BadRequestException('La cotización debe estar asociada a un evento');
    }
    if (
      quotation.event.cotizacionSeleccionadaId &&
      quotation.event.cotizacionSeleccionadaId !== quotation.id
    ) {
      throw new BadRequestException(
        'Ya existe una cotización aprobada para este evento; no se puede seleccionar otra',
      );
    }
    this.assertSecondApprover(quotation, user);
    const comunicado = await this.prisma.attachment.findFirst({
      where: {
        eventId: quotation.eventId,
        category: 'Comunicado de aprobación',
      },
      select: { id: true },
    });
    if (!comunicado) {
      throw new BadRequestException(
        'Debe cargar el Comunicado de aprobación antes de aprobar la cotización definitiva',
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedQuotation = await tx.quotation.update({
        where: { id },
        data: {
          isDefinitive: true,
          status: QUOTATION_STATUS.APROBADA,
          aprobadaPorId: user.id,
          aprobadaEn: new Date(),
        },
        include: quotationInclude,
      });
      await tx.event.update({
        where: { id: quotation.eventId },
        data: {
          cotizacionSeleccionadaId: quotation.id,
          ...(quotation.event.status === EVENT_STATUS.ABIERTO ||
          quotation.event.status === EVENT_STATUS.DEVUELTO
            ? { status: EVENT_STATUS.EN_EJECUCION }
            : {}),
        },
      });
      return updatedQuotation;
    });

    if (dto?.items?.length) {
      await this.ofertaEconomicaService.ensureFromSelectedItems(
        quotation,
        dto.items.map((item) => item.quotationItemId),
        user,
      );
    } else {
      await this.ofertaEconomicaService.ensureFromQuotation(quotation, user);
    }

    await this.notifyApproved(quotation);

    return updated;
  }

  async remove(id: string): Promise<void> {
    const quotation = await this.findOne(id);
    this.assertEventNotRejected(quotation.event);
    await this.prisma.quotation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
