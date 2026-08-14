import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateDisbursementDto, UpdateDisbursementDto } from './dto';

type Disbursement = Prisma.DisbursementGetPayload<{}>;

export interface DisbursementSummaryEventRow {
  eventId: string;
  code: string;
  suffix: string;
  name: string;
  monto: number;
  pagado: number;
  pendiente: number;
}

export interface DisbursementSummary {
  id: string;
  code: string | null;
  name: string;
  valorRef: number;
  ejecutado: number;
  disponible: number;
  porcentajeEjecucion: number;
  porcentajeParticipacion: number;
  year: number;
  status: string | null;
  isActive: boolean;
  porEvento: DisbursementSummaryEventRow[];
}

@Injectable()
export class DisbursementsService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async create(dto: CreateDisbursementDto): Promise<Disbursement> {
    return this.prisma.disbursement.create({ data: dto });
  }

  async findAll(active?: string): Promise<Disbursement[]> {
    return this.prisma.disbursement.findMany({
      where: active === 'all' ? {} : { isActive: true },
      orderBy: { year: 'desc' },
    });
  }

  async findOne(id: string): Promise<Disbursement> {
    const d = await this.prisma.disbursement.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Recurso disponible no encontrado');
    return d;
  }

  async update(id: string, dto: UpdateDisbursementDto): Promise<Disbursement> {
    await this.findOne(id);
    return this.prisma.disbursement.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    // La inactivación conserva el disbursementId de pagos y eventos ya registrados (histórico)
    await this.prisma.disbursement.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async summary(id: string): Promise<DisbursementSummary> {
    const d = await this.findOne(id);

    const [payments, ofertas, events] = await Promise.all([
      this.prisma.payment.findMany({
        where: { disbursementId: id },
        select: {
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
        where: { disbursementId: id, deletedAt: null },
        select: { id: true, code: true, suffix: true, name: true },
      }),
    ]);

    const budgetByEvent = new Map(
      ofertas.map((o) => [o.eventId, Number(o.total)]),
    );

    const activePayments = payments.filter((p) => p.status !== 'Anulado');
    const ejecutado = activePayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const participation = events.reduce(
      (sum, e) => sum + (budgetByEvent.get(e.id) ?? 0),
      0,
    );
    const valorRef = Number(d.amount);

    const porEvento: DisbursementSummaryEventRow[] = events.map((e) => {
      const eventPayments = activePayments.filter((p) => p.eventId === e.id);
      const pagado = eventPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const monto = budgetByEvent.get(e.id) ?? 0;
      return {
        eventId: e.id,
        code: e.code,
        suffix: e.suffix,
        name: e.name,
        monto: this.round2(monto),
        pagado: this.round2(pagado),
        pendiente: this.round2(Math.max(0, monto - pagado)),
      };
    });

    return {
      id: d.id,
      code: d.code,
      name: d.name,
      valorRef,
      ejecutado: this.round2(ejecutado),
      disponible: this.round2(valorRef - ejecutado),
      porcentajeEjecucion:
        valorRef > 0 ? this.round2((ejecutado / valorRef) * 100) : 0,
      porcentajeParticipacion:
        valorRef > 0 ? this.round2((participation / valorRef) * 100) : 0,
      year: d.year,
      status: d.status,
      isActive: d.isActive,
      porEvento,
    };
  }
}
