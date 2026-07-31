import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UpdateParameterDto } from './dto';

type Parameter = Prisma.ParameterGetPayload<{}>;

@Injectable()
export class ParametersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Parameter[]> {
    return this.prisma.parameter.findMany({
      where: { isActive: true },
      orderBy: { key: 'asc' },
    });
  }

  async updateByKey(key: string, dto: UpdateParameterDto): Promise<Parameter> {
    const existing = await this.prisma.parameter.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Parámetro no encontrado');

    return this.prisma.parameter.update({
      where: { key },
      data: dto,
    });
  }
}
