import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config';
import { PrismaModule } from './database/prisma.module';
import { SeedModule } from './database/seed.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

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
import { ParametersModule } from './modules/parameters/parameters.module';
import { TariffsModule } from './modules/tariffs/tariffs.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { OfertaEconomicaModule } from './modules/oferta-economica/oferta-economica.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { BackupModule } from './modules/backup/backup.module';
import { SupabaseModule } from './modules/supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    SupabaseModule,
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
    ParametersModule,
    TariffsModule,
    QuotationsModule,
    OfertaEconomicaModule,
    AttachmentsModule,
    BackupModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
