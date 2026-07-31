import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DisbursementsService } from './disbursements.service';
import { CreateDisbursementDto, UpdateDisbursementDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Desembolsos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('disbursements')
export class DisbursementsController {
  constructor(private readonly disbursementsService: DisbursementsService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Crear desembolso (solo Admin. Funcional)' })
  create(@Body() dto: CreateDisbursementDto) {
    return this.disbursementsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar desembolsos activos' })
  findAll() {
    return this.disbursementsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener desembolso por ID' })
  findOne(@Param('id') id: string) {
    return this.disbursementsService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Actualizar desembolso (solo Admin. Funcional)' })
  update(@Param('id') id: string, @Body() dto: UpdateDisbursementDto) {
    return this.disbursementsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Inactivar desembolso (solo Admin. Funcional)' })
  remove(@Param('id') id: string) {
    return this.disbursementsService.remove(id);
  }
}
