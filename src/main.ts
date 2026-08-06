import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { execSync } from 'child_process';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';

function applyMigrations() {
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (error) {
    console.error('[Migrations] Error al aplicar migraciones:', (error as Error).message);
    process.exit(1);
  }
}

async function bootstrap() {
  applyMigrations();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('SIGEV - Sistema de Gestión de Eventos')
    .setDescription('API del Sistema de Información para la Gestión de Eventos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`SIGEV API corriendo en http://localhost:${port}/api/v1`);
  console.log(`Documentación Swagger en http://localhost:${port}/api/docs`);
}

bootstrap();
