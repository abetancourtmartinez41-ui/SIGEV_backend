import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { TariffsService } from './tariffs.service';
import { CreateTariffDto, UpdateTariffDto, QueryTariffsDto, AdjustTariffDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Tarifario')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar servicios del tarifario (buscar/filtrar por hoja, tipo, vigencia)' })
  findAll(@Query() query: QueryTariffsDto) {
    return this.tariffsService.findAll(query);
  }

  @Post('import')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Importar tarifario masivo desde Excel (Admin. Funcional)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(@UploadedFile() file: Express.Multer.File) {
    return this.tariffsService.importFromExcel(file);
  }

  @Post('adjust')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Aplicar ajuste porcentual anual a una vigencia (ej. IPC 5.1%)' })
  adjustByIpc(@Body() dto: AdjustTariffDto) {
    return this.tariffsService.adjustByIpc(dto);
  }

  @Get(':id/price')
  @ApiOperation({ summary: 'Resolver precio oficial del servicio según categoría del municipio' })
  findPrice(
    @Param('id') id: string,
    @Query('municipalityCategory') municipalityCategory: string,
    @Query('vigencyYear') vigencyYear?: number,
  ) {
    return this.tariffsService.resolveUnitPrice(
      id,
      municipalityCategory,
      vigencyYear ? Number(vigencyYear) : undefined,
    );
  }

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Crear servicio del tarifario (Admin. Funcional)' })
  create(@Body() dto: CreateTariffDto) {
    return this.tariffsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener servicio del tarifario por ID' })
  findOne(@Param('id') id: string) {
    return this.tariffsService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Actualizar servicio del tarifario (Admin. Funcional)' })
  update(@Param('id') id: string, @Body() dto: UpdateTariffDto) {
    return this.tariffsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN)
  @ApiOperation({ summary: 'Inactivar servicio del tarifario sin eliminarlo (Admin. Funcional)' })
  remove(@Param('id') id: string) {
    return this.tariffsService.remove(id);
  }
}
