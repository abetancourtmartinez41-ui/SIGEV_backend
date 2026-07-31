import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ItemsService } from './items.service';
import { CreateItemDto, UpdateItemDto } from './dto';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Ítems')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Crear ítem' })
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ítems' })
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ítem por ID' })
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Actualizar ítem' })
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR)
  @ApiOperation({ summary: 'Inactivar ítem' })
  remove(@Param('id') id: string) {
    return this.itemsService.remove(id);
  }
}
