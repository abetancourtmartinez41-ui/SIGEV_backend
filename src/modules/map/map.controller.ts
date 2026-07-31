import {
  Controller, Get, Query, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MapService } from './map.service';
import { SearchMunicipalityDto } from './dto';

@ApiTags('Georreferenciación')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('municipalities')
  @ApiOperation({ summary: 'Buscar municipios por código DIVIPOLA, nombre o departamento' })
  search(@Query() dto: SearchMunicipalityDto) {
    return this.mapService.search(dto);
  }

  @Get('municipalities/:code')
  @ApiOperation({ summary: 'Obtener municipio por código DIVIPOLA' })
  findByDivipola(@Param('code') code: string) {
    return this.mapService.findByDivipola(code);
  }

  @Get('municipalities/category/:category')
  @ApiOperation({ summary: 'Listar municipios por categoría' })
  findByCategory(@Param('category') category: string) {
    return this.mapService.findByCategory(category);
  }
}
