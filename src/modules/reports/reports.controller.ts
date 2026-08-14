import {
  Controller, Post, Body, Res, UseGuards, BadRequestException,
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
  @ApiOperation({ summary: 'Generar reporte (PDF/Excel: Oferta, Matriz, Reconocimiento de pagos, Recurso disponible)' })
  async generate(@Body() dto: GenerateReportDto, @Res() res: Response) {
    if (dto.type === 'offer' && dto.format === 'pdf') {
      await this.reportsService.generateOfferPdf(dto.eventId!, res);
      return;
    }
    if (dto.type === 'matrix' && dto.format === 'excel') {
      await this.reportsService.generateMatrixExcel(dto.eventId!, res);
      return;
    }
    if (dto.type === 'payments') {
      if (!dto.eventId) throw new BadRequestException('eventId es requerido');
      if (dto.format === 'pdf') {
        await this.reportsService.generatePaymentReconocimientoPdf(dto.eventId, res);
      } else if (dto.format === 'excel') {
        await this.reportsService.generatePaymentReconocimientoExcel(dto.eventId, res);
      }
      return;
    }
    if (dto.type === 'resource') {
      if (!dto.disbursementId) throw new BadRequestException('disbursementId es requerido');
      if (dto.format === 'pdf') {
        await this.reportsService.generateResourcePaymentPdf(dto.disbursementId, res);
      } else if (dto.format === 'excel') {
        await this.reportsService.generateResourcePaymentExcel(dto.disbursementId, res);
      }
      return;
    }
    throw new BadRequestException('Combinación de tipo/formato no soportada');
  }
}
