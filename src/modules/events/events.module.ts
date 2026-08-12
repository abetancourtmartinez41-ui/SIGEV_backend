import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ItemsModule } from '../items/items.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ItemsModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
