import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { EventWithRelations } from '../../database/types';
import { CreateEventDto, UpdateEventDto, ChangeStatusDto } from './dto';
import { EventStateMachine } from './state-machine';
import { ItemsService } from '../items/items.service';
import { EVENT_STATUS, ROLES } from '../../config/constants';

const eventInclude = {
  items: true,
  attachments: true,
  createdBy: true,
  disbursement: true,
  selectedQuotation: { include: { ally: true } },
  quotations: { where: { isActive: true }, include: { ally: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly itemsService: ItemsService,
  ) {}

  private roleNames(roles: { name: string }[]): string[] {
    return roles.map((role) => role.name);
  }

  private isOperator(user: { roles: { name: string }[] }): boolean {
    return this.roleNames(user.roles).includes(ROLES.OPERATOR);
  }

  private assertAllyScope(
    event: { generalAllyId: string | null },
    user: { allyId?: string | null; roles: { name: string }[] },
  ): void {
    if (!this.isOperator(user)) return;
    if (event.generalAllyId && event.generalAllyId === user.allyId) return;
    throw new ForbiddenException(
      'Este evento pertenece a otro Aliado y su perfil solo gestiona eventos de su Aliado asignado',
    );
  }

  private normalizeSuffix(suffix?: string): string {
    return (suffix ?? '').trim().toUpperCase();
  }

  private async assertUniqueCodeSuffix(
    code: string,
    suffix: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.event.findFirst({
      where: {
        code,
        suffix,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'El número de evento con ese sufijo ya existe',
      );
    }
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
    const suffix = this.normalizeSuffix(dto.suffix);
    await this.assertUniqueCodeSuffix(dto.code, suffix);

    const roles = this.roleNames(user.roles);
    const isSolicitante = roles.includes(ROLES.SOLICITANTE);

    if (isSolicitante && dto.items?.length) {
      throw new ForbiddenException(
        'El Solicitante no puede cargar valores económicos; los ítems los registra el Operador',
      );
    }

    const initialStatus = EVENT_STATUS.ABIERTO;

    const municipality = await this.resolveMunicipality(dto);
    await this.assertDisbursementActive(dto.disbursementId);

    return this.prisma.$transaction(async (tx) => {
      const savedEvent = await tx.event.create({
        data: {
          code: dto.code,
          suffix,
          schemaType: dto.schemaType ?? 'cotizacion',
          name: dto.name,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dependency: dto.dependency ?? null,
          hamlet: dto.hamlet ?? null,
          attendees: dto.attendees ?? 0,
          days: dto.days ?? 0,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
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
          startDate: savedEvent.startDate,
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

  async findAll(user?: { allyId?: string | null; roles: { name: string }[] }): Promise<EventWithRelations[]> {
    const where: Prisma.EventWhereInput = { deletedAt: null };

    if (user && this.isOperator(user)) {
      if (user.allyId) {
        where.generalAllyId = user.allyId;
      } else {
        where.id = { in: [] };
      }
    }

    return this.prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    id: string,
    user?: { allyId?: string | null; roles: { name: string }[] },
  ): Promise<EventWithRelations> {
    const event = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (user) this.assertAllyScope(event, user);
    return event;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    user: { id: string; allyId?: string | null; roles: { name: string }[] },
  ): Promise<EventWithRelations> {
    const event = await this.findOne(id, user);
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

    const nextSuffix = dto.suffix !== undefined ? this.normalizeSuffix(dto.suffix) : event.suffix ?? '';
    const nextCode = dto.code ?? event.code;
    await this.assertUniqueCodeSuffix(nextCode, nextSuffix, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...municipality,
          schemaType: dto.schemaType !== undefined ? dto.schemaType : undefined,
          suffix: nextSuffix,
          disbursementId: dto.disbursementId ?? event.disbursementId,
          startDate:
            dto.startDate !== undefined
              ? (dto.startDate ? new Date(dto.startDate) : null)
              : undefined,
          dependency: dto.dependency !== undefined ? (dto.dependency || null) : undefined,
          hamlet: dto.hamlet !== undefined ? (dto.hamlet || null) : undefined,
          attendees: dto.attendees,
          days: dto.days,
          latitude: dto.latitude !== undefined ? dto.latitude : undefined,
          longitude: dto.longitude !== undefined ? dto.longitude : undefined,
        },
      });

      if (items && (isEditor || isAnalista)) {
        await tx.item.deleteMany({ where: { eventId: id } });
        if (items.length) {
          const eventContext = {
            id,
            municipalityCategory: municipality.municipalityCategory ?? event.municipalityCategory,
            startDate:
              dto.startDate !== undefined
                ? (dto.startDate ? new Date(dto.startDate) : null)
                : event.startDate,
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
    user: { id: string; allyId?: string | null; roles: { name: string }[] },
  ): Promise<EventWithRelations> {
    const event = await this.findOne(id, user);
    const roles = this.roleNames(user.roles);

    const quotationsCount = event.quotations?.length || 0;
    const itemsCount = event.items?.length || 0;
    EventStateMachine.canTransition(event.status, dto.status, roles, {
      quotationsCount,
      itemsCount,
      authorizeException: dto.authorizeException,
    });

    if (dto.status === EVENT_STATUS.CERRADO && !event.disbursementId) {
      throw new BadRequestException(
        'El evento debe tener un desembolso asignado antes de cerrar',
      );
    }
    await this.assertDisbursementActive(event.disbursementId ?? undefined);

    const data: {
      status: string;
      observation?: string;
      authorizeException?: boolean;
      devolucionLegalizacion?: boolean;
    } = {
      status: dto.status,
      devolucionLegalizacion:
        dto.status === EVENT_STATUS.DEVUELTO
          ? event.status === EVENT_STATUS.LEGALIZADO
          : false,
    };
    if (dto.observation) data.observation = dto.observation;
    if (dto.authorizeException) data.authorizeException = true;

    return this.prisma.event.update({
      where: { id },
      data,
      include: eventInclude,
    });
  }

  async remove(
    id: string,
    user: { allyId?: string | null; roles: { name: string }[] },
  ): Promise<void> {
    await this.findOne(id, user);
    await this.prisma.event.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
