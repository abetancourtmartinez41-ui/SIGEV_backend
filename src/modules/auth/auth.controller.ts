import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar estado del usuario admin' })
  async check() {
    const user = await this.prisma.user.findFirst({
      where: { document: 'Administrador' },
    });
    return {
      exists: !!user,
      isActive: user?.isActive ?? false,
    };
  }
}
