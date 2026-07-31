import { Module } from '@nestjs/common';
import { AlliesController } from './allies.controller';
import { AlliesService } from './allies.service';

@Module({
  controllers: [AlliesController],
  providers: [AlliesService],
  exports: [AlliesService],
})
export class AlliesModule {}
