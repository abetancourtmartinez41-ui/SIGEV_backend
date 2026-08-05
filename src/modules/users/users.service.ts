import {
  Injectable, ConflictException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UserWithRoles } from '../../database/types';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from './dto';

const userInclude = { roles: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.findOne(id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.document) data.document = dto.document;
    if (dto.fullName) data.fullName = dto.fullName;
    if (dto.email) data.email = dto.email;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;
    if (dto.roles?.length) {
      const roles = await this.prisma.role.findMany({
        where: { name: { in: dto.roles } },
      });
      data.roles = { set: roles.map((role) => ({ id: role.id })) };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      include: userInclude,
    });
  }
}
