import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { CalculationsModule } from '../calculations/calculations.module';
import { TariffsModule } from '../tariffs/tariffs.module';
import { ReportsModule } from '../reports/reports.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [CalculationsModule, TariffsModule, ReportsModule, AttachmentsModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
