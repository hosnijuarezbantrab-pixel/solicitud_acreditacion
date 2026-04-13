import { Module } from '@nestjs/common';
import { CatalogosController, AccionistasExtrasController } from './catalogos.controller';

/** G-10 FIX: módulo que expone los endpoints de catálogos faltantes */
@Module({
  controllers: [CatalogosController, AccionistasExtrasController],
})
export class CatalogosModule {}
