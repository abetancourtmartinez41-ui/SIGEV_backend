import {
  Controller, Get, Patch, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ParametersService } from './parameters.service';
import { UpdateParameterDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
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

  @Patch(':key')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Actualizar parámetro (Tasas/Fee, solo Admin. Funcional)' })
  update(@Param('key') key: string, @Body() dto: UpdateParameterDto) {
    return this.parametersService.updateByKey(key, dto);
  }
}
