import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiKeyGuard } from './common/guards/api-key.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // G-01 FIX: prefijo sin /v1 — el frontend llama a /api/*
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // G-02 FIX: exponer X-Api-Key y X-Usuario en CORS
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Usuario'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // G-02 FIX: guard global — todas las rutas requieren X-Api-Key salvo @Public()
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ApiKeyGuard(reflector));

  // G-03 FIX: ResponseInterceptor eliminado — cada endpoint retorna su objeto
  // directamente. El frontend llama r.json() y recibe el dato sin envoltorio.

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 Bantrab Accionistas API → http://localhost:${port}/api`);
  logger.log(`📋 Módulos: Accionistas · Asambleas · Acreditación · Expedientes · Firma · Catálogos · Auth`);
}
bootstrap();
