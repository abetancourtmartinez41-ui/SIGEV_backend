import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UpdateParameterDto, CreateParameterVersionDto } from './dto';

type Parameter = Prisma.ParameterGetPayload<{}>;
type ParameterVersionRow = Prisma.ParameterVersionGetPayload<{}>;

export interface ParameterVersionResponse {
  id: string;
  version: number;
  ivaRate: number;
  impuestoConsumoRate: number;
  feeTarifadoRate: number;
  feeTercerosRate: number;
  ivaFeeRate: number;
  applyFeeOnBase: boolean;
  aprobadoPor: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaCreacion: string;
  activo: boolean;
}

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

  async getActiveVersion(): Promise<ParameterVersionResponse | null> {
    const version = await this.prisma.parameterVersion.findFirst({
      where: { isActive: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    return version ? this.toResponse(version) : null;
  }

  async findVersions(): Promise<ParameterVersionResponse[]> {
    const versions = await this.prisma.parameterVersion.findMany({
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    return versions.map((version) => this.toResponse(version));
  }

  async findVersionById(id: string): Promise<ParameterVersionResponse> {
    const version = await this.prisma.parameterVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Versión de parámetros no encontrada');
    return this.toResponse(version);
  }

  async createVersion(
    dto: CreateParameterVersionDto,
    createdBy: { id: string; fullName: string },
  ): Promise<ParameterVersionResponse> {
    const latest = await this.prisma.parameterVersion.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const isActive = dto.isActive ?? true;

    const created = await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.parameterVersion.updateMany({ data: { isActive: false } });
      }
      return tx.parameterVersion.create({
        data: {
          version,
          ivaRate: dto.ivaRate,
          impuestoConsumoRate: dto.impuestoConsumoRate,
          feeTarifadoRate: dto.feeTarifadoRate,
          feeTercerosRate: dto.feeTercerosRate,
          ivaFeeRate: dto.ivaFeeRate,
          applyFeeOnBase: dto.applyFeeOnBase ?? true,
          aprobadoPor: dto.aprobadoPor?.trim() || createdBy.fullName,
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
          isActive,
          createdById: createdBy.id,
        },
      });
    });

    return this.toResponse(created);
  }

  private toResponse(version: ParameterVersionRow): ParameterVersionResponse {
    return {
      id: version.id,
      version: version.version,
      ivaRate: Number(version.ivaRate),
      impuestoConsumoRate: Number(version.impuestoConsumoRate),
      feeTarifadoRate: Number(version.feeTarifadoRate),
      feeTercerosRate: Number(version.feeTercerosRate),
      ivaFeeRate: Number(version.ivaFeeRate),
      applyFeeOnBase: version.applyFeeOnBase,
      aprobadoPor: version.aprobadoPor,
      fechaInicio: version.fechaInicio ? version.fechaInicio.toISOString() : null,
      fechaFin: version.fechaFin ? version.fechaFin.toISOString() : null,
      fechaCreacion: version.createdAt.toISOString(),
      activo: version.isActive,
    };
  }
}
