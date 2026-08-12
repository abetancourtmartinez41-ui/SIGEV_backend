import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ItemsService } from './items.service';
import { CreateItemDto, UpdateItemDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UserWithRoles } from '../../database/types';
import { ROLES } from '../../config/constants';

@ApiTags('Ítems')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.SOLICITANTE)
  @ApiOperation({ summary: 'Crear ítem' })
  create(@Body() dto: CreateItemDto, @CurrentUser() user: UserWithRoles) {
    return this.itemsService.create(dto, user);
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
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.SOLICITANTE)
  @ApiOperation({ summary: 'Actualizar ítem' })
  update(@Param('id') id: string, @Body() dto: UpdateItemDto, @CurrentUser() user: UserWithRoles) {
    return this.itemsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(ROLES.FUNCTIONAL_ADMIN, ROLES.SOLICITANTE)
  @ApiOperation({ summary: 'Inactivar ítem' })
  remove(@Param('id') id: string, @CurrentUser() user: UserWithRoles) {
    return this.itemsService.remove(id, user);
  }
}
