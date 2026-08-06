import {
  Injectable, ConflictException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UserWithRoles } from '../../database/types';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from './dto';
import { ROLES } from '../../config/constants';

const userInclude = { roles: true, ally: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveAlly(allyId?: string): Promise<string | undefined> {
    if (!allyId) return undefined;
    const ally = await this.prisma.ally.findUnique({ where: { id: allyId } });
    if (!ally) throw new BadRequestException('El aliado seleccionado no existe');
    return ally.id;
  }

  private assertOperatorHasAlly(allyId: string | undefined | null, roles?: string[]): void {
    if (roles?.includes(ROLES.OPERATOR) && !allyId) {
      throw new BadRequestException(
        'El rol Operador requiere asignar un Aliado',
      );
    }
  }

  async create(dto: CreateUserDto): Promise<UserWithRoles> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ document: dto.document }, { email: dto.email }],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.document === dto.document
          ? 'El identificador ya está registrado'
          : 'El email ya está registrado',
      );
    }

    this.assertOperatorHasAlly(dto.allyId, dto.roles);
    const allyId = await this.resolveAlly(dto.allyId ?? undefined);
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const roles = dto.roles?.length
      ? await this.prisma.role.findMany({ where: { name: { in: dto.roles } } })
      : [];

    return this.prisma.user.create({
      data: {
        document: dto.document,
        fullName: dto.fullName,
        email: dto.email,
        password: hashedPassword,
        allyId,
        roles: roles.length
          ? { connect: roles.map((role) => ({ id: role.id })) }
          : undefined,
      },
      include: userInclude,
    });
  }

  async findAll(): Promise<UserWithRoles[]> {
    return this.prisma.user.findMany({ include: userInclude });
  }

  async findOne(id: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserWithRoles> {
    const current = await this.findOne(id);

    const nextRoles = dto.roles?.length
      ? await this.prisma.role.findMany({ where: { name: { in: dto.roles } } })
      : undefined;
    const effectiveRoles = dto.roles ?? current.roles.map((r) => r.name);
    const finalAllyId = dto.allyId !== undefined ? (dto.allyId || null) : current.allyId;
    this.assertOperatorHasAlly(finalAllyId, effectiveRoles);
    const allyId = await this.resolveAlly(finalAllyId ?? undefined);

    const data: Prisma.UserUpdateInput = {};
    if (dto.document) data.document = dto.document;
    if (dto.fullName) data.fullName = dto.fullName;
    if (dto.email) data.email = dto.email;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;
    if (dto.roles?.length) {
      data.roles = { set: (nextRoles ?? []).map((role) => ({ id: role.id })) };
    }
    if (dto.allyId !== undefined) {
      data.ally = allyId ? { connect: { id: allyId } } : { disconnect: true };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      include: userInclude,
    });
  }
}
