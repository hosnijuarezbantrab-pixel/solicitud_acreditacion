import { Module } from '@nestjs/common';
import { ParticipacionService } from './participacion.service';
import {
  ParticipacionAccionistasController,
  ReportesParticipacionController,
} from './participacion.controller';

/**
 * ParticipacionModule — HU-XXXX Limitación Funcional y Acompañante Accionista
 *
 * Expone:
 *   GET/POST  /api/accionistas/:id/limitacion-funcional
 *   GET       /api/accionistas/:id/acompanante
 *   POST      /api/accionistas/validar-acompanante
 *   POST      /api/accionistas/:id/acompanante
 *   DELETE    /api/accionistas/:id/acompanante
 *   GET       /api/reportes/limitacion-funcional
 *   GET       /api/reportes/acompanante-accionista
 *
 * No requiere TypeORM.forFeature() — usa DataSource directamente para
 * ejecutar queries sobre las tablas nuevas del ER (ACCIONISTA_LIMITACION,
 * ACCIONISTA_ACOMPANANTE, BITACORA_PARTICIPACION).
 */
@Module({
  providers: [ParticipacionService],
  controllers: [
    ParticipacionAccionistasController,
    ReportesParticipacionController,
  ],
  exports: [ParticipacionService],
})
export class ParticipacionModule {}
