import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AlliesService } from './allies.service';
import { CreateAllyDto, UpdateAllyDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Aliados')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('allies')
export class AlliesController {
  constructor(private readonly alliesService: AlliesService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.SOLICITANTE, ROLES.ANALISTA, ROLES.SUPERVISOR)
  @ApiOperation({ summary: 'Crear aliado (Admin. Funcional y roles que gestionan órdenes)' })
  create(@Body() dto: CreateAllyDto) {
    return this.alliesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar aliados (por defecto solo activos; usar ?all=true para incluir inactivos)' })
  findAll(@Query('all') all?: string) {
    return this.alliesService.findAll(all === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener aliado por ID' })
  findOne(@Param('id') id: string) {
    return this.alliesService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Actualizar aliado (solo Admin. Funcional)' })
  update(@Param('id') id: string, @Body() dto: UpdateAllyDto) {
    return this.alliesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Inactivar aliado (solo Admin. Funcional)' })
  remove(@Param('id') id: string) {
    return this.alliesService.remove(id);
  }
}
