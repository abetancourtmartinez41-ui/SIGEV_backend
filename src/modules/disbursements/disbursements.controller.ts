import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DisbursementsService } from './disbursements.service';
import { CreateDisbursementDto, UpdateDisbursementDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Recursos disponibles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('disbursements')
export class DisbursementsController {
  constructor(private readonly disbursementsService: DisbursementsService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Crear recurso disponible (solo Admin. Funcional)' })
  create(@Body() dto: CreateDisbursementDto) {
    return this.disbursementsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar recursos disponibles (activos por defecto; use active=all para todos)' })
  findAll(@Query('active') active?: string) {
    return this.disbursementsService.findAll(active);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Indicadores del recurso disponible (ejecución y participación)' })
  summary(@Param('id') id: string) {
    return this.disbursementsService.summary(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener recurso disponible por ID' })
  findOne(@Param('id') id: string) {
    return this.disbursementsService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Actualizar recurso disponible (solo Admin. Funcional)' })
  update(@Param('id') id: string, @Body() dto: UpdateDisbursementDto) {
    return this.disbursementsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Inactivar recurso disponible (solo Admin. Funcional)' })
  remove(@Param('id') id: string) {
    return this.disbursementsService.remove(id);
  }
}
