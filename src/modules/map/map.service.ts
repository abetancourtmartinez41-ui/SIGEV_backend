import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { SearchMunicipalityDto } from './dto';

type Municipality = Prisma.MunicipalityGetPayload<{}>;

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchMunicipalityDto): Promise<Municipality[]> {
    const where: Prisma.MunicipalityWhereInput = {};

    if (dto.divipolaCode) {
      where.divipolaCode = { contains: dto.divipolaCode };
    }
    if (dto.name) {
      where.name = { contains: dto.name };
    }
    if (dto.department) {
      where.department = { contains: dto.department };
    }

    return this.prisma.municipality.findMany({ where });
  }

  async findByDivipola(code: string): Promise<Municipality> {
    const mun = await this.prisma.municipality.findUnique({
      where: { divipolaCode: code },
    });
    if (!mun) throw new NotFoundException('Municipio no encontrado');
    return mun;
  }

  async findByCategory(category: string): Promise<Municipality[]> {
    return this.prisma.municipality.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });
  }
}
