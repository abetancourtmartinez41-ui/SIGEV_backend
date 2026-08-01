import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { EventWithRelations } from '../../database/types';
import { CreateEventDto, UpdateEventDto, ChangeStatusDto } from './dto';
import { EventStateMachine } from './state-machine';
import { ItemsService } from '../items/items.service';
import { EVENT_STATUS, ROLES } from '../../config/constants';

const eventInclude = { items: true, attachments: true, createdBy: true, disbursement: true } as const;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly itemsService: ItemsService,
  ) {}

  private roleNames(roles: { name: string }[]): string[] {
    return roles.map((role) => role.name);
  }

  private async resolveMunicipality(dto: {
    divipolaCode?: string;
    municipalityName?: string;
    municipalityCategory?: string;
  }): Promise<{ divipolaCode?: string; municipalityName?: string; municipalityCategory?: string }> {
    if (dto.divipolaCode && !dto.municipalityCategory) {
      const municipality = await this.prisma.municipality.findUnique({
        where: { divipolaCode: dto.divipolaCode },
      });
      if (municipality) {
        return {
          divipolaCode: municipality.divipolaCode,
          municipalityName: dto.municipalityName ?? municipality.name,
          municipalityCategory: municipality.category,
        };
      }
    }
    return {
      divipolaCode: dto.divipolaCode,
      municipalityName: dto.municipalityName,
      municipalityCategory: dto.municipalityCategory,
    };
  }

  private async assertDisbursementActive(disbursementId?: string): Promise<void> {
    if (!disbursementId) return;
    const disbursement = await this.prisma.disbursement.findUnique({
      where: { id: disbursementId },
      select: { isActive: true },
    });
    if (!disbursement) {
      throw new BadRequestException('El desembolso asignado no existe');
    }
    if (!disbursement.isActive) {
      throw new BadRequestException('El desembolso asignado está inactivo');
    }
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

    const municipality = await this.resolveMunicipality(dto);
    await this.assertDisbursementActive(dto.disbursementId);

    return this.prisma.$transaction(async (tx) => {
      const savedEvent = await tx.event.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          divipolaCode: municipality.divipolaCode,
          municipalityName: municipality.municipalityName,
          municipalityCategory: municipality.municipalityCategory,
          generalAllyId: dto.generalAllyId || null,
          disbursementId: dto.disbursementId || null,
          createdById: user.id,
          status: initialStatus,
        },
      });

      if (dto.items?.length) {
        const event = {
          id: savedEvent.id,
          municipalityCategory: savedEvent.municipalityCategory,
        };
        const items: Prisma.ItemUncheckedCreateInput[] = [];
        for (const itemDto of dto.items) {
          items.push(await this.itemsService.buildItemData(itemDto, event));
        }
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

    const municipality = await this.resolveMunicipality(data);
    await this.assertDisbursementActive(dto.disbursementId);

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...municipality,
          disbursementId: dto.disbursementId ?? event.disbursementId,
        },
      });

      if (items && (isEditor || isAnalista)) {
        await tx.item.deleteMany({ where: { eventId: id } });
        if (items.length) {
          const eventContext = {
            id,
            municipalityCategory: municipality.municipalityCategory ?? event.municipalityCategory,
          };
          const itemData: Prisma.ItemUncheckedCreateInput[] = [];
          for (const itemDto of items) {
            itemData.push(await this.itemsService.buildItemData(itemDto, eventContext));
          }
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

    if (dto.status === EVENT_STATUS.EN_EJECUCION && !event.disbursementId) {
      throw new BadRequestException(
        'El evento debe tener un desembolso asignado antes de aprobar la oferta',
      );
    }
    await this.assertDisbursementActive(event.disbursementId ?? undefined);

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
