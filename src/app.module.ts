import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config';
import { PrismaModule } from './database/prisma.module';
import { SeedModule } from './database/seed.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { ItemsModule } from './modules/items/items.module';
import { CalculationsModule } from './modules/calculations/calculations.module';
import { AlliesModule } from './modules/allies/allies.module';
import { DisbursementsModule } from './modules/disbursements/disbursements.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MapModule } from './modules/map/map.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    ItemsModule,
    CalculationsModule,
    AlliesModule,
    DisbursementsModule,
    AuditModule,
    ReportsModule,
    SeedModule,
    MapModule,
  ],
})
export class AppModule {}
