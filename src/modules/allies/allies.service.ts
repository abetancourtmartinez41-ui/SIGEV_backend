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
    const existing = await this.prisma.ally.findFirst({
      where: { OR: [{ name: dto.name }, { code: dto.code }] },
    });
    if (existing) {
      const field = existing.code === dto.code ? 'código' : 'nombre';
      throw new ConflictException(`Ya existe un aliado con ese ${field}`);
    }
    return this.prisma.ally.create({ data: dto });
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
    if (dto.name || dto.code) {
      const existing = await this.prisma.ally.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.code ? [{ code: dto.code }] : []),
          ],
        },
      });
      if (existing) {
        const field = dto.code && existing.code === dto.code ? 'código' : 'nombre';
        throw new ConflictException(`Ya existe un aliado con ese ${field}`);
      }
    }
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
