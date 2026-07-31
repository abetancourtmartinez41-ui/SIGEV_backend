import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateAuditLogDto } from './dto';

type AuditLog = Prisma.AuditLogGetPayload<{}>;

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

  async findAll(): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
