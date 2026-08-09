import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, ChangeStatusDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UserWithRoles } from '../../database/types';
import { ROLES } from '../../config/constants';

@ApiTags('Eventos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(ROLES.SOLICITANTE, ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Crear evento (postulación del Solicitante)' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: UserWithRoles) {
    return this.eventsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar eventos (el Operador solo ve los de su Aliado)' })
  findAll(@CurrentUser() user: UserWithRoles) {
    return this.eventsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener evento por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserWithRoles) {
    return this.eventsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(
    ROLES.FUNCTIONAL_ADMIN,
    ROLES.OPERATOR,
    ROLES.SUPERVISOR,
    ROLES.ANALISTA,
    ROLES.SOLICITANTE,
  )
  @ApiOperation({ summary: 'Actualizar evento' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: UserWithRoles,
  ) {
    return this.eventsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(ROLES.APPROVER)
  @ApiOperation({ summary: 'Cambiar estado del evento (solo Aprobador)' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: UserWithRoles,
  ) {
    return this.eventsService.changeStatus(id, dto, user);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Eliminar evento (solo Admin. Funcional)' })
  remove(@Param('id') id: string, @CurrentUser() user: UserWithRoles) {
    return this.eventsService.remove(id, user);
  }
}
