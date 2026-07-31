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
    const existing = await this.prisma.ally.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('El aliado ya existe');
    }
    return this.prisma.ally.create({ data: dto });
  }

  async findAll(): Promise<Ally[]> {
    return this.prisma.ally.findMany({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<Ally> {
    const ally = await this.prisma.ally.findUnique({ where: { id } });
    if (!ally) throw new NotFoundException('Aliado no encontrado');
    return ally;
  }

  async update(id: string, dto: UpdateAllyDto): Promise<Ally> {
    await this.findOne(id);
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
