import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear usuario (solo admin)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Listar todos los usuarios' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar usuario (solo admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Inactivar usuario (solo admin)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
