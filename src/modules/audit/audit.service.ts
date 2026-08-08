import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateAuditLogDto, QueryAuditLogDto } from './dto';

type AuditLog = Prisma.AuditLogGetPayload<{}>;

const SORT_FIELDS: Record<string, Prisma.AuditLogScalarFieldEnum> = {
  fecha: 'createdAt',
  usuario: 'userEmail',
  accion: 'action',
  entidad: 'entityType',
  entidadId: 'entityId',
  detalle: 'action',
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        action: dto.action,
        previousValue: (dto.previousValue as Prisma.InputJsonObject) || Prisma.JsonNull,
        newValue: (dto.newValue as Prisma.InputJsonObject) || Prisma.JsonNull,
        userId: dto.userId,
        userEmail: dto.userEmail || null,
        ipAddress: dto.ipAddress || null,
      },
    });
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(query: QueryAuditLogDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.AuditLogWhereInput = {};

    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.entity) {
      const keys = query.entity
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      if (keys.length) {
        where.entityType = { in: keys };
      }
    }

    if (query.action) {
      const actionWhere = this.buildActionWhere(query.action);
      where.AND = actionWhere;
    }

    const sortField = SORT_FIELDS[query.sortBy ?? 'fecha'] ?? 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy = this.buildOrderBy(sortField, sortDir);

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private buildOrderBy(field: string, sortDir: 'asc' | 'desc'): Prisma.AuditLogOrderByWithRelationInput {
    if (field === 'userEmail') {
      return { userEmail: { sort: sortDir } };
    }
    return { [field]: sortDir } as Prisma.AuditLogOrderByWithRelationInput;
  }

  private buildActionWhere(action: string): Prisma.AuditLogWhereInput {
    switch (action) {
      case 'Creación':
        return { action: { startsWith: 'POST ' } };
      case 'Actualización':
        return {
          OR: [
            { action: { startsWith: 'PUT ' } },
            { action: { startsWith: 'PATCH ' } },
          ],
        };
      case 'Eliminación':
        return { action: { startsWith: 'DELETE ' } };
      case 'Cambio de estado':
        return { action: { contains: '/status' } };
      default:
        return { action: { startsWith: `${action} ` } };
    }
  }
}
