import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  ROLES, ROLE_LABELS, DEFAULT_VIGENCY_YEAR, TARIFF_TYPES,
} from '../config/constants';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_PARAMETERS = [
  { key: 'FEE_RATE', value: '0.0825', description: 'Fee técnico administrativo (8.25%)' },
  { key: 'FEE_IVA_RATE', value: '0.19', description: 'IVA sobre el fee (19%)' },
  { key: 'IVA_RATE', value: '0.19', description: 'IVA general aplicado a la base (19%)' },
  { key: 'CONSUMPTION_TAX_RATE', value: '0.08', description: 'Impuesto al consumo (8%)' },
  { key: 'TARIFF_VIGENCY_YEAR', value: '2026', description: 'Vigencia vigente del tarifario (Año 2026)' },
  { key: 'REQUIRED_QUOTATIONS', value: '4', description: 'Número de cotizaciones requeridas' },
];

const SAMPLE_MUNICIPALITIES = [
  { divipolaCode: '11001', name: 'Bogotá D.C.', department: 'Cundinamarca', category: 'Especial' },
  { divipolaCode: '05001', name: 'Medellín', department: 'Antioquia', category: 'Primera' },
  { divipolaCode: '08001', name: 'Barranquilla', department: 'Atlántico', category: 'Primera' },
  { divipolaCode: '50001', name: 'Villavicencio', department: 'Meta', category: 'Segunda' },
  { divipolaCode: '73001', name: 'Ibagué', department: 'Tolima', category: 'Segunda' },
  { divipolaCode: '15001', name: 'Tunja', department: 'Boyacá', category: 'Tercera' },
  { divipolaCode: '44001', name: 'Riohacha', department: 'La Guajira', category: 'Cuarta' },
  { divipolaCode: '86001', name: 'Mocoa', department: 'Putumayo', category: 'Quinta' },
  { divipolaCode: '97001', name: 'Mitú', department: 'Vaupés', category: 'Sexta' },
];

const TARIFARIO_FILE_CANDIDATES = [
  path.resolve(process.cwd(), 'tarifario.json'),
  path.resolve(__dirname, '..', '..', 'tarifario.json'),
];

const LEGACY_SAMPLE_TARIFF_CODES = [
  'ALM-D-001', 'ALM-A-001', 'ALM-C-001', 'ALM-R-001',
  'TRN-URB-001', 'TRN-INT-001', 'TRN-COM-001',
  'HOS-NOC-001', 'SVC-EXT-001',
];

interface TarifarioItem {
  id: number;
  producto_servicio: string;
  descripcion_tecnica: string | null;
  tiempo: string | null;
  unidad: string | null;
  cat_especial_1: number | null;
  cat_2_3_4: number | null;
  cat_5_6: number | null;
  observaciones: string | null;
}

interface TarifarioCategoria {
  nombre: string;
  items: TarifarioItem[];
}

interface TarifarioFile {
  metadata: unknown;
  categorias: TarifarioCategoria[];
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.ensureRoles();
      await this.ensureAdminUser();
      await this.ensureParameters();
      await this.ensureMunicipalities();
      await this.ensureTariffs();
    } catch (error) {
      console.error('[Seed] Error al ejecutar seed:', (error as Error).message);
    }
  }

  private async ensureRoles() {
    for (const role of Object.values(ROLES)) {
      await this.prisma.role.upsert({
        where: { name: role },
        update: { description: ROLE_LABELS[role] },
        create: { name: role, description: ROLE_LABELS[role] },
      });
    }
    console.log('[Seed] Perfiles RBAC asegurados (9)');
  }

  private async ensureAdminUser() {
    let user = await this.prisma.user.findUnique({
      where: { document: 'Administrador' },
      include: { roles: true },
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash('Admin123*', 10);
      user = await this.prisma.user.create({
        data: {
          document: 'Administrador',
          fullName: 'Administrador Técnico',
          email: 'admin@sigev.com',
          password: hashedPassword,
          isActive: true,
        },
        include: { roles: true },
      });
      console.log('[Seed] Usuario Administrador creado exitosamente');
    } else {
      console.log('[Seed] Usuario Administrador ya existe');
    }

    const adminRoles = [ROLES.TECHNICAL_ADMIN, ROLES.FUNCTIONAL_ADMIN];
    const missingRoles = adminRoles.filter(
      (role) => !user.roles.some((assigned) => assigned.name === role),
    );
    if (missingRoles.length) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          roles: {
            connect: missingRoles.map((name) => ({ name })),
          },
        },
      });
      console.log(`[Seed] Roles asignados al Administrador: ${missingRoles.join(', ')}`);
    }
  }

  private async ensureParameters() {
    for (const parameter of DEFAULT_PARAMETERS) {
      await this.prisma.parameter.upsert({
        where: { key: parameter.key },
        update: {},
        create: parameter,
      });
    }
    console.log(`[Seed] Parámetros por defecto asegurados (${DEFAULT_PARAMETERS.length})`);
  }

  private async ensureMunicipalities() {
    let created = 0;
    for (const municipality of SAMPLE_MUNICIPALITIES) {
      const exists = await this.prisma.municipality.findUnique({
        where: { divipolaCode: municipality.divipolaCode },
      });
      if (!exists) {
        await this.prisma.municipality.create({ data: municipality });
        created += 1;
      }
    }
    console.log(`[Seed] Municipios DIVIPOLA de muestra asegurados (${SAMPLE_MUNICIPALITIES.length}, nuevos ${created})`);
  }

  private async ensureTariffs() {
    const filePath = this.findTarifarioFile();
    if (!filePath) {
      console.warn('[Seed] No se encontró tarifario.json; se omite la carga del tarifario real');
      return;
    }

    const legacy = await this.prisma.tariff.findMany({
      where: { code: { in: LEGACY_SAMPLE_TARIFF_CODES } },
    });
    if (legacy.length > 0) {
      await this.prisma.tariff.deleteMany({
        where: { id: { in: legacy.map((tariff) => tariff.id) } },
      });
      console.log(`[Seed] Tarifas de muestra antiguas eliminadas (${legacy.length})`);
    }

    const tarifario: TarifarioFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let created = 0;
    let updated = 0;

    for (const categoria of tarifario.categorias) {
      for (const item of categoria.items) {
        const code = this.buildTariffCode(categoria.nombre, item.id);
        const data = {
          code,
          name: item.producto_servicio,
          description: item.descripcion_tecnica,
          unitMeasure: item.unidad,
          timeUnit: item.tiempo,
          observations: item.observaciones,
          sheet: categoria.nombre,
          priceEspecialPrimera: item.cat_especial_1,
          priceSegundaCuarta: item.cat_2_3_4,
          priceQuintaSexta: item.cat_5_6,
          tariffType: TARIFF_TYPES.TARIFADO,
          vigencyYear: DEFAULT_VIGENCY_YEAR,
        };

        const existing = await this.prisma.tariff.findFirst({
          where: { code, vigencyYear: DEFAULT_VIGENCY_YEAR },
        });

        if (existing) {
          await this.prisma.tariff.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await this.prisma.tariff.create({ data });
          created += 1;
        }
      }
    }

    console.log(
      `[Seed] Tarifario real cargado desde tarifario.json (${created} creadas, ${updated} actualizadas, vigencia ${DEFAULT_VIGENCY_YEAR})`,
    );
  }

  private findTarifarioFile(): string | null {
    for (const candidate of TARIFARIO_FILE_CANDIDATES) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private buildTariffCode(categoryName: string, itemId: number): string {
    const prefix = categoryName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .split(/\s+/)
      .filter((word) => word !== 'Y' && word.length > 0)
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 4);

    return `${prefix}-${String(itemId).padStart(3, '0')}`;
  }
}
