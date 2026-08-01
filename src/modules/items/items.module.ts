import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { CalculationsModule } from '../calculations/calculations.module';
import { TariffsModule } from '../tariffs/tariffs.module';

@Module({
  imports: [CalculationsModule, TariffsModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
