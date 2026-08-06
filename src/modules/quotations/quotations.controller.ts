import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto, UpdateQuotationDto, ChangeQuotationStatusDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UserWithRoles } from '../../database/types';
import { ROLES } from '../../config/constants';

@ApiTags('Ofertas Económicas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Crear oferta económica asociada a un evento' })
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: UserWithRoles) {
    return this.quotationsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ofertas económicas (el Operador solo ve las de su Aliado)' })
  findAll(@CurrentUser() user: UserWithRoles) {
    return this.quotationsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener oferta por ID' })
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Actualizar oferta (datos e ítems; los ítems se reemplazan)' })
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto, @CurrentUser() user: UserWithRoles) {
    return this.quotationsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR, ROLES.APPROVER)
  @ApiOperation({ summary: 'Cambiar estado de la oferta. Solo el Aprobador puede marcar Aprobada' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeQuotationStatusDto,
    @CurrentUser() user: UserWithRoles,
  ) {
    return this.quotationsService.changeStatus(id, dto, user);
  }

  @Patch(':id/select')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR, ROLES.APPROVER)
  @ApiOperation({ summary: 'Marcar la oferta como definitiva del evento (se persiste en el evento)' })
  select(@Param('id') id: string, @CurrentUser() user: UserWithRoles) {
    return this.quotationsService.select(id, user);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Inactivar oferta (solo Admin. Funcional)' })
  remove(@Param('id') id: string) {
    return this.quotationsService.remove(id);
  }
}
