import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { UserWithRoles } from '../../database/types';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; user: Partial<UserWithRoles> }> {
    const user = await this.prisma.user.findFirst({
      where: { document: dto.document, isActive: true },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const { password, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  }

  async validateUser(userId: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: { roles: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }
}
