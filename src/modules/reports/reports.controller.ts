import {
  Controller, Post, Body, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto';

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generar reporte (PDF Oferta / Excel Matriz)' })
  async generate(@Body() dto: GenerateReportDto, @Res() res: Response) {
    if (dto.type === 'offer' && dto.format === 'pdf') {
      await this.reportsService.generateOfferPdf(dto.eventId!, res);
    } else if (dto.type === 'matrix' && dto.format === 'excel') {
      await this.reportsService.generateMatrixExcel(dto.eventId!, res);
    }
  }
}
