import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateDisbursementDto, UpdateDisbursementDto } from './dto';

type Disbursement = Prisma.DisbursementGetPayload<{}>;

@Injectable()
export class DisbursementsService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.disbursement.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
