import {
  Controller, Get, Patch, Post, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ParametersService } from './parameters.service';
import { UpdateParameterDto, CreateParameterVersionDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Parámetros')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('parameters')
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar parámetros activos' })
  findAll() {
    return this.parametersService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener la versión de parámetros vigente' })
  getActiveVersion() {
    return this.parametersService.getActiveVersion();
  }

  @Get('versions')
  @ApiOperation({ summary: 'Listar versiones históricas de parámetros' })
  findVersions() {
    return this.parametersService.findVersions();
  }

  @Get('versions/:id')
  @ApiOperation({ summary: 'Obtener una versión de parámetros por id' })
  findVersionById(@Param('id') id: string) {
    return this.parametersService.findVersionById(id);
  }

  @Post('versions')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Crear nueva versión de parámetros de cálculo (Admin. Funcional)' })
  createVersion(
    @Body() dto: CreateParameterVersionDto,
    @CurrentUser() user: { id: string; fullName: string },
  ) {
    return this.parametersService.createVersion(dto, user);
  }

  @Patch(':key')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Actualizar parámetro (Tasas/FEE, solo Admin. Funcional)' })
  update(@Param('key') key: string, @Body() dto: UpdateParameterDto) {
    return this.parametersService.updateByKey(key, dto);
  }
}
