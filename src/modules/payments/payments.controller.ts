import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UserWithRoles } from '../../database/types';
import { ROLES } from '../../config/constants';

@ApiTags('Pagos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Registrar un pago de un evento' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: UserWithRoles) {
    return this.paymentsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pagos (filtrable por evento)' })
  findAll(@Query('eventId') eventId?: string) {
    return this.paymentsService.findAll(eventId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de ejecución presupuestal por recurso disponible' })
  summary() {
    return this.paymentsService.summary();
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Actualizar un pago registrado' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Eliminar un pago registrado' })
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
