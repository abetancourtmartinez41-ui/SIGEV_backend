import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DisbursementsService } from './disbursements.service';
import { CreateDisbursementDto, UpdateDisbursementDto } from './dto';

@ApiTags('Desembolsos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('disbursements')
export class DisbursementsController {
  constructor(private readonly disbursementsService: DisbursementsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear desembolso' })
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
  @ApiOperation({ summary: 'Actualizar desembolso' })
  update(@Param('id') id: string, @Body() dto: UpdateDisbursementDto) {
    return this.disbursementsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inactivar desembolso (eliminación lógica)' })
  remove(@Param('id') id: string) {
    return this.disbursementsService.remove(id);
  }
}
