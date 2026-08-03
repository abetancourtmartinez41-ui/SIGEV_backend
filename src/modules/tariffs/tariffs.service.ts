import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import {
  MUNICIPALITY_CATEGORY_TO_TARIFF_GROUP,
  TARIFF_PRICE_COLUMNS,
  TARIFF_PRICE_GROUPS,
  TARIFF_TYPES,
  DEFAULT_VIGENCY_YEAR,
} from '../../config/constants';
import { CreateTariffDto, UpdateTariffDto, QueryTariffsDto, AdjustTariffDto } from './dto';
import * as ExcelJS from 'exceljs';

type Tariff = Prisma.TariffGetPayload<{}>;

const PRICE_COLUMNS = Object.values(TARIFF_PRICE_COLUMNS);

@Injectable()
export class TariffsService {
  private readonly defaultVigencyYear: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.defaultVigencyYear = this.configService.get<number>('vigency.year', DEFAULT_VIGENCY_YEAR);
  }

  getCurrentVigencyYear(): number {
    return this.defaultVigencyYear;
  }

  getPriceColumnForCategory(municipalityCategory: string | null | undefined): string | null {
    if (!municipalityCategory) return null;
    const group = MUNICIPALITY_CATEGORY_TO_TARIFF_GROUP[municipalityCategory];
    if (!group) return null;
    return TARIFF_PRICE_COLUMNS[group as keyof typeof TARIFF_PRICE_COLUMNS];
  }

  async findAll(query: QueryTariffsDto): Promise<Tariff[]> {
    const where: Prisma.TariffWhereInput = {};

    if (!query.includeInactive) {
      where.isActive = true;
    }
    if (query.sheet) {
      where.sheet = query.sheet;
    }
    if (query.tariffType) {
      where.tariffType = query.tariffType;
    }
    if (query.vigencyYear) {
      where.vigencyYear = query.vigencyYear;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.tariff.findMany({
      where,
      orderBy: [{ sheet: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Tariff> {
    const tariff = await this.prisma.tariff.findUnique({ where: { id } });
    if (!tariff) throw new NotFoundException('Servicio del tarifario no encontrado');
    return tariff;
  }

  async create(dto: CreateTariffDto): Promise<Tariff> {
    const year = dto.vigencyYear ?? this.defaultVigencyYear;
    const data = {
      code: dto.code,
      name: dto.name,
      description: dto.description,
      unitMeasure: dto.unitMeasure,
      timeUnit: dto.timeUnit,
      observations: dto.observations,
      sheet: dto.sheet,
      priceEspecialPrimera: dto.priceEspecialPrimera,
      priceSegundaCuarta: dto.priceSegundaCuarta,
      priceQuintaSexta: dto.priceQuintaSexta,
      tariffType: dto.tariffType ?? TARIFF_TYPES.TARIFADO,
      vigencyYear: year,
      fechaInicio: dto.fechaInicio ?? new Date(year, 0, 1),
      fechaFin: dto.fechaFin ?? new Date(year, 11, 31),
    };

    return this.prisma.tariff.create({ data });
  }

  async update(id: string, dto: UpdateTariffDto): Promise<Tariff> {
    await this.findOne(id);
    return this.prisma.tariff.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<Tariff> {
    await this.findOne(id);
    return this.prisma.tariff.update({ where: { id }, data: { isActive: false } });
  }

  async resolveUnitPrice(
    tariffId: string,
    municipalityCategory: string | null | undefined,
    vigencyYear?: number,
    referenceDate?: Date | null,
  ): Promise<Decimal | null> {
    const tariff = await this.prisma.tariff.findUnique({ where: { id: tariffId } });
    if (!tariff) throw new NotFoundException('Servicio del tarifario no encontrado');
    if (!tariff.isActive) {
      throw new BadRequestException('El servicio del tarifario está inactivo');
    }
    if (tariff.tariffType === TARIFF_TYPES.NO_TARIFADO) {
      throw new BadRequestException(
        'El servicio NO_TARIFADO no tiene precio oficial; debe diligenciarse manualmente',
      );
    }

    const year = vigencyYear ?? this.defaultVigencyYear;
    if (tariff.vigencyYear !== year) {
      throw new BadRequestException(
        `El servicio pertenece a la vigencia ${tariff.vigencyYear} y no es válido para ${year}`,
      );
    }

    this.assertValidForDate(tariff, referenceDate);

    const column = this.getPriceColumnForCategory(municipalityCategory);
    if (!column) {
      throw new BadRequestException('No se puede determinar el precio para la categoría del municipio');
    }

    const price = tariff[column as keyof Tariff] as Decimal | null;
    if (price === null || price === undefined) {
      throw new BadRequestException(
        `El servicio no tiene precio publicado para la categoría del municipio (${municipalityCategory})`,
      );
    }
    return price;
  }

  async resolveTariffItem(
    tariffId: string,
    municipalityCategory: string | null | undefined,
    vigencyYear?: number,
    referenceDate?: Date | null,
  ): Promise<{ name: string; description: string | null; unitMeasure: string | null; unitPrice: Decimal }> {
    const tariff = await this.prisma.tariff.findUnique({ where: { id: tariffId } });
    if (!tariff) throw new NotFoundException('Servicio del tarifario no encontrado');

    const unitPrice = await this.resolveUnitPrice(
      tariffId,
      municipalityCategory,
      vigencyYear,
      referenceDate,
    );
    return {
      name: tariff.name,
      description: tariff.description,
      unitMeasure: tariff.unitMeasure,
      unitPrice: unitPrice as Decimal,
    };
  }

  private assertValidForDate(
    tariff: Tariff,
    referenceDate?: Date | null,
  ): void {
    if (!referenceDate || !tariff.fechaInicio || !tariff.fechaFin) return;
    const toDay = (value: Date): number => Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    );
    const reference = toDay(referenceDate);
    const start = toDay(tariff.fechaInicio);
    const end = toDay(tariff.fechaFin);
    if (reference < start || reference > end) {
      const fmt = (value: number): string => new Date(value).toISOString().slice(0, 10);
      throw new BadRequestException(
        `El servicio no está vigente para la fecha indicada (vigencia ${fmt(start)} a ${fmt(end)})`,
      );
    }
  }

  async adjustByIpc(dto: AdjustTariffDto): Promise<{ updated: number }> {
    const factor = 1 + dto.ipcPercentage / 100;
    const tariffs = await this.prisma.tariff.findMany({
      where: {
        vigencyYear: dto.vigencyYear,
        tariffType: dto.tariffType ?? TARIFF_TYPES.TARIFADO,
        isActive: true,
      },
    });

    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const tariff of tariffs) {
        const data: Record<string, Decimal> = {};
        for (const column of PRICE_COLUMNS) {
          const value = tariff[column as keyof Tariff] as Decimal | null;
          if (value !== null && value !== undefined) {
            data[column] = value.mul(factor).round();
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.tariff.update({ where: { id: tariff.id }, data });
          updated += 1;
        }
      }
    });

    return { updated };
  }

  async importFromExcel(
    file: Express.Multer.File,
  ): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    if (!file) throw new BadRequestException('Debe adjuntar un archivo Excel (.xlsx)');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('El archivo no contiene hojas de cálculo');

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = this.normalizeHeader(String(cell.value ?? ''));
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const read = (values: (unknown)[], normalizedKey: string): unknown => {
      const index = headers.indexOf(normalizedKey);
      if (index === -1) return undefined;
      return values[index + 1];
    };

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values = row.values as (unknown)[];

      try {
        const name = this.toString(read(values, 'nombre') ?? read(values, 'servicio') ?? read(values, 'producto'));
        if (!name) {
          skipped += 1;
          errors.push(`Fila ${rowNumber}: falta el nombre del servicio`);
          continue;
        }

        const code = this.toString(read(values, 'codigo'));
        const description = this.toString(read(values, 'descripcion'));
        const unitMeasure = this.toString(
          read(values, 'unidad') ?? read(values, 'unidaddemedida') ?? read(values, 'unidadmedida'),
        );
        const timeUnit = this.toString(
          read(values, 'tiempo') ?? read(values, 'periodo') ?? read(values, 'tiempodeprestacion'),
        );
        const observations = this.toString(
          read(values, 'observaciones') ?? read(values, 'observacion') ?? read(values, 'notas'),
        );
        const sheet = this.toString(read(values, 'hoja') ?? read(values, 'categoria') ?? read(values, 'hojacategoria'));
        const vigencyYear = this.toInt(
          read(values, 'vigencia') ?? read(values, 'ano') ?? read(values, 'anio') ?? read(values, 'vigencyyear'),
          this.defaultVigencyYear,
        );
        const tariffType = this.normalizeTariffType(
          this.toString(read(values, 'tipo') ?? read(values, 'tiposervicio') ?? read(values, 'tarifado')),
        );

        const priceEspecialPrimera = this.toNumber(
          read(values, 'especialprimera') ?? read(values, 'precioespecial') ?? read(values, 'preciosespecialprimera'),
        );
        const priceSegundaCuarta = this.toNumber(
          read(values, 'segundacuarta') ?? read(values, 'preciosegundacuarta'),
        );
        const priceQuintaSexta = this.toNumber(
          read(values, 'quintasexta') ?? read(values, 'precioquintasexta'),
        );

        const data: Prisma.TariffUncheckedCreateInput = {
          code,
          name,
          description,
          unitMeasure,
          timeUnit,
          observations,
          sheet,
          vigencyYear,
          tariffType,
          priceEspecialPrimera,
          priceSegundaCuarta,
          priceQuintaSexta,
          fechaInicio: new Date(vigencyYear, 0, 1),
          fechaFin: new Date(vigencyYear, 11, 31),
        };

        const existing = code
          ? await this.prisma.tariff.findFirst({
              where: { code, vigencyYear },
            })
          : null;

        if (existing) {
          await this.prisma.tariff.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await this.prisma.tariff.create({ data });
          created += 1;
        }
      } catch (error) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: ${(error as Error).message}`);
      }
    }

    return { created, updated, skipped, errors };
  }

  private normalizeHeader(header: string): string {
    return header
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private toString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private toInt(value: unknown, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
  }

  private normalizeTariffType(value: string | undefined): string {
    if (!value) return TARIFF_TYPES.TARIFADO;
    const normalized = this.normalizeHeader(value);
    if (['notarifado', 'manual', 'libre', 'externo'].includes(normalized)) {
      return TARIFF_TYPES.NO_TARIFADO;
    }
    return TARIFF_TYPES.TARIFADO;
  }
}
