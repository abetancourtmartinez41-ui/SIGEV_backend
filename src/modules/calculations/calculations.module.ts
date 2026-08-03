import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParametersModule } from '../parameters/parameters.module';
import { CalculationsService } from './calculations.service';

@Module({
  imports: [ConfigModule, ParametersModule],
  providers: [CalculationsService],
  exports: [CalculationsService],
})
export class CalculationsModule {}
