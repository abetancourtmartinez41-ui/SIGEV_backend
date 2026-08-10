import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UserWithRoles } from '../../database/types';
import { CalculationsService } from '../calculations/calculations.service';
import { ReportsService } from '../reports/reports.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ROLES } from '../../config/constants';

const ofertaEconomicaInclude = {
  event: { include: { disbursement: true } },
  quotation: { include: { ally: true } },
  ally: true,
  createdBy: true,
  items: { orderBy: { createdAt: 'asc' as const } },
} as const;

type OfertaEconomicaWithRelations = Prisma.OfertaEconomicaGetPayload<{
  include: typeof ofertaEconomicaInclude;
}>;

interface QuotationForOferta {
  id: string;
  code: string;
  name: string;
  cliente: string | null;
  eventId: string;
  allyId: string | null;
  currency: string;
  ally: { name: string } | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: Prisma.Decimal | number;
    ivaRate: Prisma.Decimal | number;
    consumptionTaxRate: Prisma.Decimal | number;
    feeRate: Prisma.Decimal | number;
    feeIvaRate: Prisma.Decimal | number;
    allyId: string | null;
    tariffId: string | null;
    isTariffed: boolean;
  }[];
}

const number = (value: Prisma.Decimal | number): number => Number(value);

@Injectable()
export class OfertaEconomicaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationsService: CalculationsService,
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
      'La oferta económica definitiva pertenece a un evento de otro Aliado y su perfil solo gestiona eventos de su Aliado asignado',
    );
  }

  private async resolveEvent(id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  /**
   * Crea la Oferta Económica definitiva a partir de la cotización seleccionada
   * (idempotente: si ya existe para el evento, la devuelve). Aplica el Motor de
   * Cálculo (IVA, Impuesto al consumo, Fee Técnico Administrativo e IVA del Fee)
   * y genera el PDF "Presupuesto Final" en la Carpeta 4 del evento.
   */
  async ensureFromQuotation(
    quotation: QuotationForOferta,
    user: UserWithRoles,
  ): Promise<OfertaEconomicaWithRelations> {
    const existing = await this.prisma.ofertaEconomica.findFirst({
      where: { eventId: quotation.eventId, isActive: true },
      include: ofertaEconomicaInclude,
    });

    const oferta = existing ?? (await this.buildFromQuotation(quotation, user));

    await this.ensurePresupuestoFinalPdf(oferta, quotation, user);

    return this.findOne(oferta.id);
  }

  private async buildFromQuotation(
    quotation: QuotationForOferta,
    user: UserWithRoles,
  ): Promise<OfertaEconomicaWithRelations> {
    const event = await this.resolveEvent(quotation.eventId);
    const rates = await this.calculationsService.getActiveRates();

    const itemsData: Omit<Prisma.OfertaEconomicaItemUncheckedCreateInput, 'ofertaEconomicaId'>[] = [];
    let baseTotal = 0;
    let ivaTotal = 0;
    let impuestoConsumoTotal = 0;
    let feeTarifadoTotal = 0;
    let feeTercerosTotal = 0;
    let feeTotal = 0;
    let ivaFeeTotal = 0;
    let granTotal = 0;

    for (const item of quotation.items) {
      const calculated = this.calculationsService.calculateItem({
        name: item.description,
        quantity: item.quantity,
        unitPrice: number(item.unitPrice),
        ivaRate: number(item.ivaRate),
        consumptionTaxRate: number(item.consumptionTaxRate),
        feeRate: number(item.feeRate) || rates.feeRate,
        feeIvaRate: number(item.feeIvaRate) || rates.feeIvaRate,
        feeApplyOn: rates.feeApplyOn,
        allyId: item.allyId ?? undefined,
        tariffId: item.tariffId ?? undefined,
      });

      const esTarifada = calculated.ivaRate > 0 || calculated.consumptionTaxRate > 0;
      const feeTarifadoValue = esTarifada ? calculated.feeValue : 0;
      const feeTercerosValue = calculated.feeValue - feeTarifadoValue;

      baseTotal += calculated.baseValue;
      ivaTotal += calculated.ivaValue;
      impuestoConsumoTotal += calculated.consumptionTaxValue;
      feeTarifadoTotal += feeTarifadoValue;
      feeTercerosTotal += feeTercerosValue;
      feeTotal += calculated.feeValue;
      ivaFeeTotal += calculated.feeIvaValue;
      granTotal += calculated.totalValue;

      itemsData.push({
        quotationItemId: item.id,
        description: item.description,
        quantity: calculated.quantity,
        unitPrice: calculated.unitPrice,
        baseValue: calculated.baseValue,
        ivaRate: calculated.ivaRate,
        ivaValue: calculated.ivaValue,
        consumptionTaxRate: calculated.consumptionTaxRate,
        consumptionTaxValue: calculated.consumptionTaxValue,
        feeRate: calculated.feeRate,
        feeTarifadoValue,
        feeTercerosValue,
        feeIvaRate: calculated.feeIvaRate,
        feeIvaValue: calculated.feeIvaValue,
        totalValue: calculated.totalValue,
        allyId: item.allyId,
        tariffId: item.tariffId,
        isTariffed: item.isTariffed,
      });
    }

    const base = event.code + (event.suffix ? `-${event.suffix}` : '');
    const count = await this.prisma.ofertaEconomica.count({ where: { eventId: event.id } });
    const code = `OFC-${base}-${count + 1}`;

    const saved = await this.prisma.$transaction(async (tx) => {
      const oferta = await tx.ofertaEconomica.create({
        data: {
          code,
          name: 'Oferta económica definitiva',
          eventId: event.id,
          quotationId: quotation.id,
          allyId: quotation.allyId ?? event.generalAllyId,
          baseTotal,
          ivaTotal,
          impuestoConsumoTotal,
          feeTarifadoTotal,
          feeTercerosTotal,
          feeTotal,
          ivaFeeTotal,
          total: granTotal,
          currency: quotation.currency || 'COP',
          status: 'Definitiva',
          createdById: user.id,
        },
      });
      if (itemsData.length) {
        await tx.ofertaEconomicaItem.createMany({
          data: itemsData.map((item) => ({ ...item, ofertaEconomicaId: oferta.id })),
        });
      }
      return oferta;
    });

    return this.findOne(saved.id);
  }

  private async ensurePresupuestoFinalPdf(
    oferta: OfertaEconomicaWithRelations,
    quotation: QuotationForOferta,
    user: UserWithRoles,
  ): Promise<void> {
    const existingAttachment = await this.prisma.attachment.findFirst({
      where: { eventId: oferta.eventId, category: 'Presupuesto final' },
    });
    if (existingAttachment) return;

    const municipality = oferta.event.divipolaCode
      ? await this.prisma.municipality.findUnique({
          where: { divipolaCode: oferta.event.divipolaCode },
        })
      : null;

    const buffer = await this.reportsService.generatePresupuestoFinalPdf({
      event: {
        code: oferta.event.code,
        suffix: oferta.event.suffix ?? '',
        name: oferta.event.name,
        status: oferta.event.status,
        startDate: oferta.event.startDate,
        dependency: oferta.event.dependency ?? null,
        hamlet: oferta.event.hamlet ?? null,
        schemaType: oferta.event.schemaType,
        attendees: oferta.event.attendees,
        days: oferta.event.days,
        municipalityName: municipality?.name ?? oferta.event.municipalityName ?? null,
        municipalityCategory: oferta.event.municipalityCategory ?? null,
        department: municipality?.department ?? null,
      },
      quotation: {
        code: quotation.code,
        name: quotation.name ?? '',
        cliente: quotation.cliente,
        ally: quotation.ally ? { name: quotation.ally.name } : null,
      },
      oferta: {
        code: oferta.code,
        name: oferta.name,
        currency: oferta.currency,
        baseTotal: Number(oferta.baseTotal),
        ivaTotal: Number(oferta.ivaTotal),
        impuestoConsumoTotal: Number(oferta.impuestoConsumoTotal),
        feeTarifadoTotal: Number(oferta.feeTarifadoTotal),
        feeTercerosTotal: Number(oferta.feeTercerosTotal),
        feeTotal: Number(oferta.feeTotal),
        ivaFeeTotal: Number(oferta.ivaFeeTotal),
        total: Number(oferta.total),
        items: oferta.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          baseValue: Number(item.baseValue),
          ivaValue: Number(item.ivaValue),
          consumptionTaxValue: Number(item.consumptionTaxValue),
          feeTarifadoValue: Number(item.feeTarifadoValue),
          feeTercerosValue: Number(item.feeTercerosValue),
          feeIvaValue: Number(item.feeIvaValue),
          totalValue: Number(item.totalValue),
        })),
      },
      generatedBy: { fullName: user.fullName, email: user.email },
      generatedAt: new Date(),
    });

    await this.attachmentsService.saveGeneratedPdf({
      eventId: oferta.eventId,
      category: 'Presupuesto final',
      fileName: `presupuesto-final-${quotation.code.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
      buffer,
      uploadedById: user.id,
    });
  }

  async findAll(user?: { allyId?: string | null; roles: { name: string }[] }): Promise<OfertaEconomicaWithRelations[]> {
    const where: Prisma.OfertaEconomicaWhereInput = { isActive: true };
    if (user && this.isOperator(user)) {
      if (user.allyId) {
        where.event = { generalAllyId: user.allyId };
      } else {
        where.id = { in: [] };
      }
    }
    return this.prisma.ofertaEconomica.findMany({
      where,
      include: ofertaEconomicaInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEvent(
    eventId: string,
    user?: { allyId?: string | null; roles: { name: string }[] },
  ): Promise<OfertaEconomicaWithRelations | null> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (user) this.assertAllyScope(event, user);
    return this.prisma.ofertaEconomica.findFirst({
      where: { eventId, isActive: true },
      include: ofertaEconomicaInclude,
    });
  }

  async findOne(id: string): Promise<OfertaEconomicaWithRelations> {
    const oferta = await this.prisma.ofertaEconomica.findFirst({
      where: { id, isActive: true },
      include: ofertaEconomicaInclude,
    });
    if (!oferta) throw new NotFoundException('Oferta económica definitiva no encontrada');
    return oferta;
  }
}
