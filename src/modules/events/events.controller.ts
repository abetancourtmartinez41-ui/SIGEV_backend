import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, ChangeStatusDto } from './dto';
import { CurrentUser } from '../../common/decorators';
import { UserWithRoles } from '../../database/types';

@ApiTags('Eventos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear evento' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: UserWithRoles) {
    return this.eventsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar eventos' })
  findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener evento por ID' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar evento' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado del evento' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: UserWithRoles,
  ) {
    return this.eventsService.changeStatus(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar evento' })
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
