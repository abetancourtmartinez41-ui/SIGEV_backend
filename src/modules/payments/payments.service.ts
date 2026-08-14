import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import { EVENT_STATUS } from '../../config/constants';

const paymentInclude = {
  event: {
    select: {
      id: true,
      code: true,
      suffix: true,
      name: true,
      disbursementId: true,
    },
  },
  disbursement: true,
  createdBy: { select: { id: true, fullName: true } },
  paymentItems: {
    include: {
      item: { select: { id: true, name: true, totalValue: true } },
    },
  },
  attachments: true,
} as const;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

export interface PaymentSummaryEventRow {
  eventId: string;
  code: string;
  suffix: string;
  name: string;
  monto: number;
  pagado: number;
  pendiente: number;
}

export interface PaymentSummaryRow {
  disbursementId: string;
  name: string;
  amount: number;
  paid: number;
  available: number;
  percentage: number;
  valorRef: number;
  ejecutado: number;
  disponible: number;
  porcentajeEjecucion: number;
  porcentajeParticipacion: number;
  porEvento: PaymentSummaryEventRow[];
}

interface Allocation {
  itemId: string;
  itemName: string;
  amount: number;
}

interface BuiltAllocations {
  allocations: Allocation[];
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async sumPaymentsBy(where: {
    eventId?: string;
    disbursementId?: string;
  }): Promise<number> {
    const agg = await this.prisma.payment.aggregate({
      where: { ...where, status: { not: 'Anulado' } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private async itemPaid(itemId: string): Promise<number> {
    const agg = await this.prisma.paymentItem.aggregate({
      where: { itemId, payment: { status: { not: 'Anulado' } } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private normalizeBudgetKey(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private async buildOfferBudgetByKey(
    eventId: string,
  ): Promise<Map<string, number>> {
    const oferta = await this.prisma.ofertaEconomica.findFirst({
      where: { eventId, isActive: true },
      select: {
        items: { select: { description: true, totalValue: true } },
      },
    });
    const budget = new Map<string, number>();
    for (const item of oferta?.items ?? []) {
      const key = this.normalizeBudgetKey(item.description);
      budget.set(key, (budget.get(key) ?? 0) + Number(item.totalValue));
    }
    return budget;
  }

  private resolveItemPending(
    item: {
      name: string;
      description: string | null;
      totalValue: number | string | Prisma.Decimal;
    },
    offerBudgetByKey: Map<string, number>,
    paidItem: number,
  ): number {
    let budget: number | undefined;
    for (const key of [item.name, item.description ?? '']) {
      if (!key.trim()) continue;
      const candidate = offerBudgetByKey.get(this.normalizeBudgetKey(key));
      if (candidate !== undefined) {
        budget = candidate;
        break;
      }
    }
    const itemBudget = budget ?? Number(item.totalValue);
    return Math.max(0, itemBudget - paidItem);
  }

  private assertPositiveAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }
  }

  private async participationOfOtherEvents(
    disbursementId: string,
    excludeEventId: string,
  ): Promise<number> {
    const events = await this.prisma.event.findMany({
      where: {
        disbursementId,
        id: { not: excludeEventId },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (events.length === 0) return 0;
    const ofertas = await this.prisma.ofertaEconomica.findMany({
      where: {
        eventId: { in: events.map((e) => e.id) },
        isActive: true,
      },
      select: { total: true },
    });
    return ofertas.reduce((sum, oferta) => sum + Number(oferta.total), 0);
  }

  private async buildAllocations(
    dto: CreatePaymentDto,
    eventId: string,
    amount: number,
  ): Promise<BuiltAllocations> {
    const items = dto.items;
    let requestedIds: string[] = [];
    if (items && items.length > 0) {
      requestedIds = items.map((i) => i.itemId);
      if (new Set(requestedIds).size !== requestedIds.length) {
        throw new BadRequestException('No puede repetir un mismo ítem en el pago');
      }
    }

    if (dto.method === 'por_item') {
      if (!items || items.length === 0) {
        throw new BadRequestException(
          'Debe indicar al menos un ítem para un pago por ítem',
        );
      }
    }

    let targetItems = await this.prisma.item.findMany({
      where: { id: { in: requestedIds }, eventId, isActive: true },
    });
    if (dto.method === 'prorrateo' && requestedIds.length === 0) {
      targetItems = await this.prisma.item.findMany({
        where: { eventId, isActive: true },
      });
    }
    if (targetItems.length === 0) {
      throw new BadRequestException(
        'El evento no cuenta con ítems activos para asociar al pago',
      );
    }
  const byId = new Map(targetItems.map((item) => [item.id, item]));
  if (requestedIds.some((id) => !byId.has(id))) {
    throw new BadRequestException(
      'Uno de los ítems no pertenece al evento o está inactivo',
    );
  }

  const offerBudgetByKey = await this.buildOfferBudgetByKey(eventId);

  let allocations: Allocation[];
    if (dto.method === 'por_item') {
      allocations = [];
      let sum = 0;
      for (const row of items!) {
        const item = byId.get(row.itemId)!;
        const itemAmount = Number(row.amount);
        this.assertPositiveAmount(itemAmount);
        const paidItem = await this.itemPaid(row.itemId);
        const pending = this.resolveItemPending(item, offerBudgetByKey, paidItem);
        if (itemAmount > pending + 0.001) {
          throw new BadRequestException(
            `El monto asignado al ítem "${item.name}" excede su saldo pendiente (${pending.toFixed(2)})`,
          );
        }
        sum += itemAmount;
        allocations.push({
          itemId: row.itemId,
          itemName: item.name,
          amount: this.round2(itemAmount),
        });
      }
      if (Math.abs(sum - amount) > 0.01) {
        throw new BadRequestException(
          `La suma de los ítems (${sum.toFixed(2)}) debe coincidir con el monto del pago (${amount.toFixed(2)})`,
        );
      }
    } else {
      const n = targetItems.length;
      if (amount < n) {
        throw new BadRequestException(
          'El monto del pago es muy pequeño para prorratearlo entre todos los ítems',
        );
      }
      const base = Math.floor((amount / n) * 100) / 100;
      allocations = [];
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const item = targetItems[i];
        const itemAmount = i === n - 1 ? this.round2(amount - acc) : base;
        if (itemAmount <= 0) {
          throw new BadRequestException(
            'El monto del pago es muy pequeño para prorratearlo entre todos los ítems',
          );
        }
        const paidItem = await this.itemPaid(item.id);
        const pending = this.resolveItemPending(item, offerBudgetByKey, paidItem);
        if (itemAmount > pending + 0.001) {
          throw new BadRequestException(
            `La porción asignada al ítem "${item.name}" excede su saldo pendiente (${pending.toFixed(2)})`,
          );
        }
        acc += itemAmount;
        allocations.push({
          itemId: item.id,
          itemName: item.name,
          amount: this.round2(itemAmount),
        });
      }
    }

    return { allocations };
  }

  async create(
    dto: CreatePaymentDto,
    user: { id: string },
  ): Promise<PaymentWithRelations> {
    const event = await this.prisma.event.findFirst({
      where: { id: dto.eventId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const oferta = await this.prisma.ofertaEconomica.findFirst({
      where: { eventId: event.id, isActive: true },
    });
    if (!oferta) {
      throw new BadRequestException(
        'El evento debe contar con oferta económica aprobada antes de registrar pagos',
      );
    }

    const amount = Number(dto.amount);
    this.assertPositiveAmount(amount);

    if (dto.esAdicional && event.status !== EVENT_STATUS.CERRADO) {
      throw new BadRequestException(
        'Los pagos adicionales solo pueden registrarse cuando el evento está Cerrado',
      );
    }

    const disbursementId = dto.disbursementId ?? event.disbursementId;
    if (!disbursementId) {
      throw new BadRequestException(
        'El pago requiere un Recurso Disponible asignado',
      );
    }
    const disbursement = await this.prisma.disbursement.findFirst({
      where: { id: disbursementId, isActive: true },
    });
    if (!disbursement) {
      throw new BadRequestException(
        'El Recurso Disponible indicado no existe o no está activo',
      );
    }
    if (event.disbursementId && event.disbursementId !== disbursementId) {
      throw new BadRequestException(
        'El evento ya está asociado a otro Recurso Disponible',
      );
    }

    const built = await this.buildAllocations(dto, event.id, amount);

    const budgetEvent = Number(oferta.total);

    const paidResource = await this.sumPaymentsBy({ disbursementId });
    if (paidResource + amount > Number(disbursement.amount) + 0.001) {
      throw new BadRequestException(
        `El pago excede el Valor REF del recurso "${disbursement.name}" (${Number(disbursement.amount).toFixed(2)})`,
      );
    }

    const eventAlreadyAssociated = event.disbursementId === disbursementId;
    if (!eventAlreadyAssociated) {
      const participationBase = await this.participationOfOtherEvents(
        disbursementId,
        event.id,
      );
      if (participationBase + budgetEvent > Number(disbursement.amount) + 0.001) {
        throw new BadRequestException(
          `La participación de los eventos asociados al recurso "${disbursement.name}" excede su Valor REF (${Number(disbursement.amount).toFixed(2)})`,
        );
      }
    }

    const paidEvent = await this.sumPaymentsBy({ eventId: event.id });
    const saldoOferta = budgetEvent - paidEvent;
    if (amount > saldoOferta + 0.001) {
      throw new BadRequestException(
        `El pago excede el saldo disponible de la oferta económica del evento (saldo: ${saldoOferta.toFixed(2)})`,
      );
    }

    const saldoDisb = Number(disbursement.amount) - paidResource;
    if (saldoDisb >= 0 && amount > saldoDisb + 0.001) {
      throw new BadRequestException(
        `El pago excede el saldo disponible del recurso "${disbursement.name}" (saldo: ${saldoDisb.toFixed(2)})`,
      );
    }

    const attachment = await this.prisma.attachment.findFirst({
      where: { id: dto.attachmentId, eventId: event.id },
    });
    if (!attachment) {
      throw new BadRequestException(
        'El soporte documental no existe o no pertenece a este evento',
      );
    }
    if (attachment.paymentId) {
      throw new BadRequestException(
        'El soporte documental ya está asociado a otro pago',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          eventId: event.id,
          disbursementId,
          amount,
          method: dto.method,
          esAdicional: dto.esAdicional ?? false,
          description: dto.description,
          createdById: user.id,
        },
        include: paymentInclude,
      });

      await tx.paymentItem.createMany({
        data: built.allocations.map((allocation) => ({
          paymentId: payment.id,
          itemId: allocation.itemId,
          amount: allocation.amount,
        })),
      });

      await tx.attachment.update({
        where: { id: attachment.id },
        data: { paymentId: payment.id },
      });

      if (!event.disbursementId) {
        await tx.event.update({
          where: { id: event.id },
          data: { disbursementId },
        });
      }

      return payment;
    });
  }

  async findAll(eventId?: string): Promise<PaymentWithRelations[]> {
    return this.prisma.payment.findMany({
      where: eventId ? { eventId } : {},
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async summary(): Promise<PaymentSummaryRow[]> {
    const [disbursements, payments, ofertas, events] = await Promise.all([
      this.prisma.disbursement.findMany({ where: { isActive: true } }),
      this.prisma.payment.findMany({
        select: {
          disbursementId: true,
          eventId: true,
          amount: true,
          status: true,
        },
      }),
      this.prisma.ofertaEconomica.findMany({
        where: { isActive: true },
        select: { eventId: true, total: true },
      }),
      this.prisma.event.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, suffix: true, name: true, disbursementId: true },
      }),
    ]);

    const budgetByEvent = new Map(
      ofertas.map((o) => [o.eventId, Number(o.total)]),
    );

    const groups = new Map<
      string,
      {
        paid: number;
        porEvento: Map<string, { paid: number }>;
      }
    >();
    for (const d of disbursements) {
      groups.set(d.id, { paid: 0, porEvento: new Map() });
    }

    for (const payment of payments) {
      if (!payment.disbursementId || payment.status === 'Anulado') continue;
      const group = groups.get(payment.disbursementId);
      if (!group) continue;
      group.paid += Number(payment.amount);
      const entry = group.porEvento.get(payment.eventId) ?? { paid: 0 };
      entry.paid += Number(payment.amount);
      group.porEvento.set(payment.eventId, entry);
    }

    return disbursements.map((d) => {
      const group = groups.get(d.id)!;
      const valorRef = Number(d.amount);
      const paid = this.round2(group.paid);
      const available = this.round2(valorRef - paid);
      const associated = events.filter((e) => e.disbursementId === d.id);
      const participation = associated.reduce(
        (sum, e) => sum + (budgetByEvent.get(e.id) ?? 0),
        0,
      );
      const porEvento: PaymentSummaryEventRow[] = associated.map((e) => {
        const entry = group.porEvento.get(e.id) ?? { paid: 0 };
        const monto = budgetByEvent.get(e.id) ?? 0;
        return {
          eventId: e.id,
          code: e.code,
          suffix: e.suffix,
          name: e.name,
          monto: this.round2(monto),
          pagado: this.round2(entry.paid),
          pendiente: this.round2(Math.max(0, monto - entry.paid)),
        };
      });
      const disbursementName = d.name;
      const id = d.id;
      return {
        disbursementId: id,
        name: disbursementName,
        amount: valorRef,
        paid,
        available,
        percentage: valorRef > 0 ? this.round2(paid / valorRef) : 0,
        valorRef,
        ejecutado: paid,
        disponible: available,
        porcentajeEjecucion:
          valorRef > 0 ? this.round2((paid / valorRef) * 100) : 0,
        porcentajeParticipacion:
          valorRef > 0 ? this.round2((participation / valorRef) * 100) : 0,
        porEvento,
      };
    });
  }

  async update(
    id: string,
    dto: UpdatePaymentDto,
  ): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findFirst({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status === 'Anulado') {
      throw new BadRequestException('No puede modificar un pago anulado');
    }

    const nextAmount =
      dto.amount !== undefined ? Number(dto.amount) : Number(payment.amount);
    this.assertPositiveAmount(nextAmount);

    const event = await this.prisma.event.findFirst({
      where: { id: payment.eventId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    if (
      dto.esAdicional !== undefined &&
      dto.esAdicional &&
      event.status !== EVENT_STATUS.CERRADO
    ) {
      throw new BadRequestException(
        'Los pagos adicionales solo pueden registrarse cuando el evento está Cerrado',
      );
    }

    const oferta = await this.prisma.ofertaEconomica.findFirst({
      where: { eventId: payment.eventId, isActive: true },
    });
    if (!oferta) {
      throw new BadRequestException(
        'El evento debe contar con oferta económica aprobada antes de modificar pagos',
      );
    }
    const budgetEvent = Number(oferta.total);

    const paidEventOthers =
      (await this.sumPaymentsBy({ eventId: payment.eventId })) -
      Number(payment.amount);
    const saldoOferta = budgetEvent - paidEventOthers;
    if (nextAmount > saldoOferta + 0.001) {
      throw new BadRequestException(
        `El pago excede el saldo disponible de la oferta económica del evento (saldo: ${saldoOferta.toFixed(2)})`,
      );
    }

    const disbursementId =
      dto.disbursementId !== undefined
        ? dto.disbursementId || null
        : payment.disbursementId;
    if (disbursementId) {
      const disbursement = await this.prisma.disbursement.findFirst({
        where: { id: disbursementId, isActive: true },
      });
      if (!disbursement) {
        throw new BadRequestException(
          'El Recurso Disponible indicado no existe o no está activo',
        );
      }
      if (
        event.disbursementId &&
        event.disbursementId !== disbursementId
      ) {
        throw new BadRequestException(
          'El evento ya está asociado a otro Recurso Disponible',
        );
      }
      const paidResourceOthers =
        (await this.sumPaymentsBy({ disbursementId })) -
        Number(payment.amount);
      if (paidResourceOthers + nextAmount > Number(disbursement.amount) + 0.001) {
        throw new BadRequestException(
          `El pago excede el Valor REF del recurso "${disbursement.name}" (${Number(disbursement.amount).toFixed(2)})`,
        );
      }
      if (!event.disbursementId) {
        const participationBase = await this.participationOfOtherEvents(
          disbursementId,
          event.id,
        );
        if (
          participationBase + budgetEvent >
          Number(disbursement.amount) + 0.001
        ) {
          throw new BadRequestException(
            `La participación de los eventos asociados al recurso "${disbursement.name}" excede su Valor REF (${Number(disbursement.amount).toFixed(2)})`,
          );
        }
      }
    }

    const existingItems = await this.prisma.paymentItem.findMany({
      where: { paymentId: id },
      select: { amount: true },
    });
    const existingSum = existingItems.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    if (existingItems.length > 0 && Math.abs(existingSum - nextAmount) > 0.01) {
      throw new BadRequestException(
        'El monto debe coincidir con la suma de los ítems ya asociados al pago',
      );
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined ? { amount: nextAmount } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.esAdicional !== undefined ? { esAdicional: dto.esAdicional } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.disbursementId !== undefined
          ? { disbursementId: dto.disbursementId || null }
          : {}),
      },
      include: paymentInclude,
    });
  }

  async remove(id: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.updateMany({
        where: { paymentId: id },
        data: { paymentId: null },
      });
      await tx.paymentItem.deleteMany({ where: { paymentId: id } });
      await tx.payment.delete({ where: { id } });
    });
  }
}
