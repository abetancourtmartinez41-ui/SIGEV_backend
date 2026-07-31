import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ROLES, ROLE_LABELS } from '../config/constants';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.ensureRoles();
      await this.ensureAdminUser();
    } catch (error) {
      console.error('[Seed] Error al ejecutar seed:', (error as Error).message);
    }
  }

  private async ensureRoles() {
    for (const role of Object.values(ROLES)) {
      await this.prisma.role.upsert({
        where: { name: role },
        update: { description: ROLE_LABELS[role] },
        create: { name: role, description: ROLE_LABELS[role] },
      });
    }
    console.log('[Seed] Perfiles RBAC asegurados (9)');
  }

  private async ensureAdminUser() {
    let user = await this.prisma.user.findUnique({
      where: { document: 'Administrador' },
      include: { roles: true },
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash('Admin123*', 10);
      user = await this.prisma.user.create({
        data: {
          document: 'Administrador',
          fullName: 'Administrador Técnico',
          email: 'admin@sigev.com',
          password: hashedPassword,
          isActive: true,
        },
        include: { roles: true },
      });
      console.log('[Seed] Usuario Administrador creado exitosamente');
    } else {
      console.log('[Seed] Usuario Administrador ya existe');
    }

    const hasTechnicalAdmin = user.roles.some(
      (role) => role.name === ROLES.TECHNICAL_ADMIN,
    );
    if (!hasTechnicalAdmin) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          roles: {
            connect: { name: ROLES.TECHNICAL_ADMIN },
          },
        },
      });
      console.log('[Seed] Rol technical_admin asignado al Administrador');
    }
  }
}
