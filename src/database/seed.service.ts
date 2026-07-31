import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.ensureAdminUser();
    } catch (error) {
      console.error('[Seed] Error al crear usuario Administrador:', (error as Error).message);
    }
  }

  private async ensureAdminUser() {
    const existing = await this.prisma.user.findUnique({
      where: { document: 'Administrador' },
    });
    if (existing) {
      console.log('[Seed] Usuario Administrador ya existe');
      return;
    }

    const hashedPassword = await bcrypt.hash('Admin123*', 10);
    await this.prisma.user.create({
      data: {
        document: 'Administrador',
        fullName: 'Administrador Técnico',
        email: 'admin@sigev.com',
        password: hashedPassword,
        isActive: true,
      },
    });
    console.log('[Seed] Usuario Administrador creado exitosamente');
  }
}
