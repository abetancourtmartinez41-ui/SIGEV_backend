import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';

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
} as const;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

export interface PaymentSummaryRow {
  disbursementId: string;
  name: string;
  amount: number;
  paid: number;
  available: number;
  percentage: number;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async sumBy(
    where: { eventId?: string; disbursementId?: string },
  ): Promise<number> {
    const agg = await this.prisma.payment.aggregate({
      where,
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private assertPositiveAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }
  }

  async create(dto: CreatePaymentDto, user: { id: string }): Promise<PaymentWithRelations> {
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

    const paidEvent = await this.sumBy({ eventId: event.id });
    const saldoOferta = Number(oferta.total) - paidEvent;
    if (amount > saldoOferta) {
      throw new BadRequestException(
        `El pago excede el saldo disponible de la oferta económica del evento (saldo: ${saldoOferta.toFixed(2)})`,
      );
    }

    const disbursementId = dto.disbursementId ?? event.disbursementId ?? undefined;
    if (disbursementId) {
      const disbursement = await this.prisma.disbursement.findFirst({
        where: { id: disbursementId },
      });
      if (disbursement) {
        const paidDisb = await this.sumBy({ disbursementId });
        const saldoDisb = Number(disbursement.amount) - paidDisb;
        if (saldoDisb >= 0 && amount > saldoDisb) {
          throw new BadRequestException(
            `El pago excede el saldo disponible del recurso "${disbursement.name}" (saldo: ${saldoDisb.toFixed(2)})`,
          );
        }
      }
    }

    return this.prisma.payment.create({
      data: {
        eventId: event.id,
        disbursementId,
        amount,
        type: dto.type,
        paymentDate: dto.paymentDate,
        description: dto.description,
        createdById: user.id,
      },
      include: paymentInclude,
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
    const [disbursements, payments] = await Promise.all([
      this.prisma.disbursement.findMany({ where: { isActive: true } }),
      this.prisma.payment.findMany({
        select: { disbursementId: true, amount: true },
      }),
    ]);

    const groups = new Map<
      string,
      { disbursementId: string; name: string; amount: number; paid: number }
    >();
    for (const d of disbursements) {
      groups.set(d.id, {
        disbursementId: d.id,
        name: d.name,
        amount: Number(d.amount),
        paid: 0,
      });
    }
    for (const p of payments) {
      if (!p.disbursementId) continue;
      const group = groups.get(p.disbursementId);
      if (group) group.paid += Number(p.amount);
    }

    return Array.from(groups.values()).map((g) => ({
      ...g,
      available: g.amount - g.paid,
      percentage: g.amount > 0 ? g.paid / g.amount : 0,
    }));
  }

  async update(id: string, dto: UpdatePaymentDto): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findFirst({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const nextAmount =
      dto.amount !== undefined ? Number(dto.amount) : Number(payment.amount);
    this.assertPositiveAmount(nextAmount);

    const oferta = await this.prisma.ofertaEconomica.findFirst({
      where: { eventId: payment.eventId, isActive: true },
    });
    if (!oferta) {
      throw new BadRequestException(
        'El evento debe contar con oferta económica aprobada antes de modificar pagos',
      );
    }

    const paidOthers =
      (await this.sumBy({ eventId: payment.eventId })) - Number(payment.amount);
    const saldoOferta = Number(oferta.total) - paidOthers;
    if (nextAmount > saldoOferta) {
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
        where: { id: disbursementId },
      });
      if (disbursement) {
        const paidOthersDisb =
          (await this.sumBy({ disbursementId })) - Number(payment.amount);
        const saldoDisb = Number(disbursement.amount) - paidOthersDisb;
        if (saldoDisb >= 0 && nextAmount > saldoDisb) {
          throw new BadRequestException(
            `El pago excede el saldo disponible del recurso "${disbursement.name}" (saldo: ${saldoDisb.toFixed(2)})`,
          );
        }
      }
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined ? { amount: nextAmount } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.paymentDate !== undefined ? { paymentDate: dto.paymentDate } : {}),
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
    await this.prisma.payment.delete({ where: { id } });
  }
}
