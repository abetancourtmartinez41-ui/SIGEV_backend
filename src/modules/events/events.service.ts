import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventWithRelations } from '../../database/types';
import { CreateEventDto, UpdateEventDto, ChangeStatusDto } from './dto';
import { EventStateMachine } from './state-machine';
import { CalculationsService } from '../calculations/calculations.service';
import { EVENT_STATUS, ROLES } from '../../config/constants';

const eventInclude = { items: true, attachments: true, createdBy: true } as const;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationsService: CalculationsService,
  ) {}

  private roleNames(roles: { name: string }[]): string[] {
    return roles.map((role) => role.name);
  }

  async create(
    dto: CreateEventDto,
    user: { id: string; roles: { name: string }[] },
  ): Promise<EventWithRelations> {
    const existing = await this.prisma.event.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException('El código del evento ya existe');
    }

    const roles = this.roleNames(user.roles);
    const isSolicitante = roles.includes(ROLES.SOLICITANTE);

    if (isSolicitante && dto.items?.length) {
      throw new ForbiddenException(
        'El Solicitante no puede cargar valores económicos; los ítems los registra el Operador',
      );
    }

    const initialStatus = isSolicitante
      ? EVENT_STATUS.POSTULADO
      : EVENT_STATUS.EN_PREPARACION;

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
          createdById: user.id,
          status: initialStatus,
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

  async update(
    id: string,
    dto: UpdateEventDto,
    user: { id: string; roles: { name: string }[] },
  ): Promise<EventWithRelations> {
    const event = await this.findOne(id);
    const roles = this.roleNames(user.roles);

    const isEditor = roles.some((role) =>
      [ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR, ROLES.SUPERVISOR].includes(role as never),
    );
    const isAnalista = roles.includes(ROLES.ANALISTA);
    const isSolicitante = roles.includes(ROLES.SOLICITANTE);

    if (!isEditor && !isAnalista && !isSolicitante) {
      throw new ForbiddenException('Su perfil no puede editar eventos');
    }

    if (isAnalista && event.status !== EVENT_STATUS.DEVUELTO) {
      throw new ForbiddenException(
        'El Analista solo puede ajustar eventos devueltos por el Aprobador',
      );
    }

    if (isSolicitante) {
      if (event.status !== EVENT_STATUS.DEVUELTO) {
        throw new ForbiddenException(
          'El Solicitante solo puede ajustar soportes de eventos devueltos',
        );
      }
      if (dto.items?.length) {
        throw new ForbiddenException(
          'El Solicitante no puede modificar ítems económicos',
        );
      }
    }

    const { items, ...data } = dto as UpdateEventDto & { items?: CreateEventDto['items'] };

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id }, data });

      if (items && (isEditor || isAnalista)) {
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
    user: { id: string; roles: { name: string }[] },
  ): Promise<EventWithRelations> {
    const event = await this.findOne(id);
    const roles = this.roleNames(user.roles);

    const quotationsCount = event.attachments?.length || 0;
    EventStateMachine.canTransition(event.status, dto.status, roles, {
      quotationsCount,
      authorizeException: dto.authorizeException,
    });

    const data: { status: string; observation?: string; authorizeException?: boolean } = {
      status: dto.status,
    };
    if (dto.observation) data.observation = dto.observation;
    if (dto.authorizeException) data.authorizeException = true;

    return this.prisma.event.update({
      where: { id },
      data,
      include: eventInclude,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.event.delete({ where: { id } });
  }
}
