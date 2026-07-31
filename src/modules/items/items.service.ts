import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateItemDto, UpdateItemDto } from './dto';
import { CalculationsService } from '../calculations/calculations.service';

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationsService: CalculationsService,
  ) {}

  async create(dto: CreateItemDto): Promise<Prisma.ItemGetPayload<{}>> {
    const itemData = this.calculationsService.calculateItem(dto);
    return this.prisma.item.create({
      data: itemData as Prisma.ItemUncheckedCreateInput,
    });
  }

  async findAll(): Promise<Prisma.ItemGetPayload<{}>[]> {
    return this.prisma.item.findMany({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<Prisma.ItemGetPayload<{}>> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    return item;
  }

  async update(id: string, dto: UpdateItemDto): Promise<Prisma.ItemGetPayload<{}>> {
    const item = await this.findOne(id);
    const itemData = this.calculationsService.calculateItem({
      ...item,
      ...dto,
    } as CreateItemDto);
    return this.prisma.item.update({
      where: { id },
      data: itemData,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.item.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
