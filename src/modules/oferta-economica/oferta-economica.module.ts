import { Module } from '@nestjs/common';
import { OfertaEconomicaController } from './oferta-economica.controller';
import { OfertaEconomicaService } from './oferta-economica.service';
import { CalculationsModule } from '../calculations/calculations.module';
import { ReportsModule } from '../reports/reports.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [CalculationsModule, ReportsModule, AttachmentsModule],
  controllers: [OfertaEconomicaController],
  providers: [OfertaEconomicaService],
  exports: [OfertaEconomicaService],
})
export class OfertaEconomicaModule {}
