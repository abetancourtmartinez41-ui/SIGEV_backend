import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalculationsService } from './calculations.service';

@Module({
  imports: [ConfigModule],
  providers: [CalculationsService],
  exports: [CalculationsService],
})
export class CalculationsModule {}
