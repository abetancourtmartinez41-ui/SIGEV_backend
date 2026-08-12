import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  ROLES, ROLE_LABELS, DEFAULT_VIGENCY_YEAR, TARIFF_TYPES,
} from '../config/constants';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_PARAMETERS = [
  { key: 'FEE_RATE', value: '0.0825', description: 'FEE técnico administrativo (8.25%)' },
  { key: 'FEE_IVA_RATE', value: '0.19', description: 'IVA sobre el FEE (19%)' },
  { key: 'IVA_RATE', value: '0.19', description: 'IVA general aplicado a la base (19%)' },
  { key: 'CONSUMPTION_TAX_RATE', value: '0.08', description: 'Impuesto a consumo (INC) (8%)' },
  { key: 'TARIFF_VIGENCY_YEAR', value: '2026', description: 'Vigencia vigente del tarifario (Año 2026)' },
  { key: 'REQUIRED_QUOTATIONS', value: '4', description: 'Número de cotizaciones requeridas' },
];

const DIVIPOLA_FILE_CANDIDATES = [
  path.resolve(process.cwd(), 'DIVIPOLA.json'),
  path.resolve(__dirname, '..', '..', 'DIVIPOLA.json'),
];

const MUNICIPALITY_CATEGORIES_FILE_CANDIDATES = [
  path.resolve(process.cwd(), 'municipality-categories.json'),
  path.resolve(__dirname, '..', '..', 'municipality-categories.json'),
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

interface DivipolaMunicipality {
  ID_DIVIPOLA: string;
  Cod_Depto: string;
  Nombre_Depto: string;
  Cod_Mun: string;
  Nombre_Mun: string;
  Categoria_Ley_617: string | null;
  Latitud: number;
  Longitud: number;
}

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

    const adminRoles = [ROLES.TECHNICAL_ADMIN];
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
    const existingCount = await this.prisma.municipality.count();
    if (existingCount >= 1000) {
      console.log(
        `[Seed] Municipios DIVIPOLA ya cargados (${existingCount}); se omite la importación`,
      );
      return;
    }

    const divipolaPath = this.findFilePath(DIVIPOLA_FILE_CANDIDATES, 'DIVIPOLA.json');
    const categoriesPath = this.findFilePath(
      MUNICIPALITY_CATEGORIES_FILE_CANDIDATES,
      'municipality-categories.json',
    );
    if (!divipolaPath || !categoriesPath) {
      console.warn(
        '[Seed] No se encontró DIVIPOLA.json o municipality-categories.json; se omite la importación de municipios',
      );
      return;
    }

    const raw: Record<string, DivipolaMunicipality> = JSON.parse(
      fs.readFileSync(divipolaPath, 'utf8'),
    );
    const categories: Record<string, string> = JSON.parse(
      fs.readFileSync(categoriesPath, 'utf8'),
    );

    let created = 0;
    let updated = 0;
    for (const key of Object.keys(raw)) {
      const municipality = raw[key];
      const data = {
        name: this.titleCase(municipality.Nombre_Mun),
        department: this.titleCase(municipality.Nombre_Depto),
        category: categories[municipality.ID_DIVIPOLA] ?? 'Sexta',
        normalizedName: this.normalizeText(municipality.Nombre_Mun),
        normalizedDepartment: this.normalizeText(municipality.Nombre_Depto),
        latitude: municipality.Latitud,
        longitude: municipality.Longitud,
      };
      const existing = await this.prisma.municipality.findUnique({
        where: { divipolaCode: municipality.ID_DIVIPOLA },
      });
      if (existing) {
        await this.prisma.municipality.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        await this.prisma.municipality.create({
          data: { divipolaCode: municipality.ID_DIVIPOLA, ...data },
        });
        created += 1;
      }
    }
    console.log(
      `[Seed] Municipios DIVIPOLA importados (${Object.keys(raw).length}, ${created} nuevos, ${updated} actualizados)`,
    );
  }

  private findFilePath(candidates: string[], label: string): string | null {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private titleCase(value: string): string {
    const lowercaseWords = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'a']);
    let isFirstWord = true;
    return value
      .toLowerCase()
      .split(/(\s+)/)
      .map((token) => {
        if (!token.trim() || /^\s+$/.test(token)) return token;
        if (/^([a-z]\.){1,3}$/i.test(token)) return token.toUpperCase();
        if (!isFirstWord && lowercaseWords.has(token)) return token;
        isFirstWord = false;
        return token.charAt(0).toUpperCase() + token.slice(1);
      })
      .join('');
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
