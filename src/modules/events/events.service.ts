import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventWithRelations } from '../../database/types';
import { CreateEventDto, UpdateEventDto, ChangeStatusDto } from './dto';
import { EventStateMachine } from './state-machine';
import { CalculationsService } from '../calculations/calculations.service';

const eventInclude = { items: true, attachments: true, createdBy: true } as const;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationsService: CalculationsService,
  ) {}

  async create(dto: CreateEventDto, userId: string): Promise<EventWithRelations> {
    const existing = await this.prisma.event.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException('El código del evento ya existe');
    }

    return this.prisma.$transaction(async (tx) => {
      const savedEvent = await tx.event.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          divipolaCode: dto.divipolaCode,
          municipalityName: dto.municipalityName,
          municipalityCategory: dto.municipalityCategory,
          generalAllyId: dto.generalAllyId || null,
          createdById: userId,
          status: 'Abierto',
        },
      });

      if (dto.items?.length) {
        const items = dto.items.map((itemDto) => {
          const calculated = this.calculationsService.calculateItem(itemDto);
          return {
            ...calculated,
            eventId: savedEvent.id,
          };
        });
        await tx.item.createMany({ data: items });
      }

      return tx.event.findUniqueOrThrow({
        where: { id: savedEvent.id },
        include: eventInclude,
      });
    });
  }

  async findAll(): Promise<EventWithRelations[]> {
    return this.prisma.event.findMany({
      include: eventInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<EventWithRelations> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventWithRelations> {
    await this.findOne(id);
    const { items, ...data } = dto as UpdateEventDto & { items?: CreateEventDto['items'] };

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id }, data });

      if (items) {
        await tx.item.deleteMany({ where: { eventId: id } });
        if (items.length) {
          const itemData = items.map((itemDto) => ({
            ...this.calculationsService.calculateItem(itemDto),
            eventId: id,
          }));
          await tx.item.createMany({ data: itemData });
        }
      }

      return tx.event.findUniqueOrThrow({
        where: { id },
        include: eventInclude,
      });
    });
  }

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    userId: string,
  ): Promise<EventWithRelations> {
    const event = await this.findOne(id);

    const attachmentsCount = event.attachments?.length || 0;
    EventStateMachine.canTransition(event.status, dto.status, { attachmentsCount });

    return this.prisma.event.update({
      where: { id },
      data: { status: dto.status },
      include: eventInclude,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.event.delete({ where: { id } });
  }
}
