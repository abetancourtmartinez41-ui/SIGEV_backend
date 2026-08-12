import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateAllyDto, UpdateAllyDto } from './dto';

type Ally = Prisma.AllyGetPayload<{}>;

@Injectable()
export class AlliesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAllyDto): Promise<Ally> {
    const code = dto.code?.trim() || (await this.generateCode(dto.divipolaCode));
    await this.assertNoDuplicate(undefined, [
      { column: 'code', label: 'código', value: code },
      { column: 'name', label: 'nombre', value: dto.name },
      { column: 'document', label: 'número de identificación', value: dto.document },
      { column: 'contactEmail', label: 'correo electrónico', value: dto.contactEmail },
    ]);
    return this.prisma.ally.create({ data: { ...dto, code } });
  }

  private async assertNoDuplicate(
    id: string | undefined,
    checks: { column: 'code' | 'name' | 'document' | 'contactEmail'; label: string; value?: string }[],
  ): Promise<void> {
    for (const check of checks) {
      if (!check.value?.trim()) continue;
      const existing = await this.prisma.ally.findFirst({
        where: {
          id: id ? { not: id } : undefined,
          [check.column]: { equals: check.value.trim(), mode: 'insensitive' },
        },
      });
      if (existing) {
        throw new ConflictException(`Ya existe un aliado con ese ${check.label}`);
      }
    }
  }

  private async generateCode(divipolaCode?: string): Promise<string> {
    const dept = divipolaCode ?? '00';
    const existing = await this.prisma.ally.findMany({
      where: { divipolaCode: dept },
      select: { code: true },
    });
    const re = new RegExp(`^AL-${dept}-(\\d+)$`);
    let max = 0;
    for (const ally of existing) {
      const match = ally.code.match(re);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
    return `AL-${dept}-${String(max + 1).padStart(3, '0')}`;
  }

  async findAll(includeInactive = false): Promise<Ally[]> {
    return this.prisma.ally.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Ally> {
    const ally = await this.prisma.ally.findUnique({ where: { id } });
    if (!ally) throw new NotFoundException('Aliado no encontrado');
    return ally;
  }

  async update(id: string, dto: UpdateAllyDto): Promise<Ally> {
    await this.findOne(id);
    await this.assertNoDuplicate(id, [
      { column: 'code', label: 'código', value: dto.code },
      { column: 'name', label: 'nombre', value: dto.name },
      { column: 'document', label: 'número de identificación', value: dto.document },
      { column: 'contactEmail', label: 'correo electrónico', value: dto.contactEmail },
    ]);
    return this.prisma.ally.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.ally.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
