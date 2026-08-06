import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { SearchMunicipalityDto, MunicipalityStatsDto } from './dto';
import { ROLES } from '../../config/constants';

type Municipality = Prisma.MunicipalityGetPayload<{}>;

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  private roleNames(roles: { name: string }[]): string[] {
    return roles.map((role) => role.name);
  }

  private applyAllyScope(
    where: Prisma.EventWhereInput,
    user?: { allyId?: string | null; roles: { name: string }[] },
  ): void {
    if (!user) return;
    if (!this.roleNames(user.roles).includes(ROLES.OPERATOR)) return;
    if (user.allyId) {
      where.generalAllyId = user.allyId;
    } else {
      where.id = { in: [] };
    }
  }

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

  async municipalityStats(
    dto: MunicipalityStatsDto,
    user?: { allyId?: string | null; roles: { name: string }[] },
  ) {
    const where: Prisma.EventWhereInput = { deletedAt: null };
    this.applyAllyScope(where, user);

    if (dto.divipolaCode) where.divipolaCode = dto.divipolaCode;
    if (dto.generalAllyId) where.generalAllyId = dto.generalAllyId;
    if (dto.disbursementId) where.disbursementId = dto.disbursementId;
    if (dto.status) where.status = dto.status;

    const events = await this.prisma.event.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    const codes = [
      ...new Set(
        events
          .map((e) => e.divipolaCode)
          .filter((c): c is string => Boolean(c)),
      ),
    ];

    const municipalities = codes.length
      ? await this.prisma.municipality.findMany({
          where: { divipolaCode: { in: codes } },
        })
      : [];

    const munMap = new Map(
      municipalities.map((m) => [m.divipolaCode, m] as const),
    );

    const grouped: Record<
      string,
      {
        municipioId: string;
        municipioNombre: string;
        departamento: string;
        lat: number;
        lng: number;
        totalEventos: number;
        totalValor: number;
        eventos: Array<{
          id: string;
          numeroEvento: string;
          responsable: string;
          estado: string;
          total: number;
          lat?: number;
          lng?: number;
        }>;
      }
    > = {};

    for (const event of events) {
      const code = event.divipolaCode;
      if (!code) continue;
      const mun = munMap.get(code);
      if (!mun) continue;

      const eventTotal = event.items.reduce(
        (sum, item) => sum + Number(item.totalValue),
        0,
      );

      if (!grouped[code]) {
        grouped[code] = {
          municipioId: code,
          municipioNombre: mun.name,
          departamento: mun.department,
          lat: Number(mun.latitude) || 0,
          lng: Number(mun.longitude) || 0,
          totalEventos: 0,
          totalValor: 0,
          eventos: [],
        };
      }

      grouped[code].eventos.push({
        id: event.id,
        numeroEvento: event.code,
        responsable: event.name,
        estado: event.status,
        total: eventTotal,
        lat:
          event.latitude !== null && event.longitude !== null
            ? Number(event.latitude)
            : undefined,
        lng:
          event.latitude !== null && event.longitude !== null
            ? Number(event.longitude)
            : undefined,
      });
      grouped[code].totalEventos += 1;
      grouped[code].totalValor += eventTotal;
    }

    return Object.values(grouped).sort((a, b) => b.totalValor - a.totalValor);
  }
}
