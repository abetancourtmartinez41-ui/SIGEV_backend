import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OfertaEconomicaService } from './oferta-economica.service';
import { CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UserWithRoles } from '../../database/types';

@ApiTags('Oferta Económica Definitiva')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ofertas-economicas')
export class OfertaEconomicaController {
  constructor(private readonly ofertaEconomicaService: OfertaEconomicaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar ofertas económicas definitivas (el Operador solo ve las de su Aliado)' })
  findAll(@CurrentUser() user: UserWithRoles) {
    return this.ofertaEconomicaService.findAll(user);
  }

  @Get('event/:eventId')
  @ApiOperation({ summary: 'Obtener la oferta económica definitiva de un evento (null si aún no existe)' })
  findByEvent(@Param('eventId') eventId: string, @CurrentUser() user: UserWithRoles) {
    return this.ofertaEconomicaService.findByEvent(eventId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener oferta económica definitiva por ID' })
  findOne(@Param('id') id: string) {
    return this.ofertaEconomicaService.findOne(id);
  }
}
