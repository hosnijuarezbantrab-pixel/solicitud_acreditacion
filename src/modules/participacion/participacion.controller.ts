import {
  Controller, Get, Post, Delete,
  Param, Query, Body, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsArray, IsOptional, IsNotEmpty } from 'class-validator';
import { ParticipacionService } from './participacion.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { UsuarioActual } from '../../common/decorators/usuario.decorator';

// ── DTOs inline ───────────────────────────────────────────────────────────────

class GuardarLimitacionDto {
  @IsArray()
  limitaciones: string[];

  @IsString() @IsOptional()
  observaciones?: string;
}

class ValidarAcompananteDto {
  @IsString() @IsNotEmpty() dpi: string;
  @IsString() @IsNotEmpty() titular: string;
  @IsString() @IsNotEmpty() asamblea: string;
}

class GuardarAcompananteDto {
  @IsString() @IsNotEmpty() asamblea: string;
  @IsString() @IsNotEmpty() acompanante_id: string;
}

class EliminarAcompananteDto {
  @IsString() @IsNotEmpty() asamblea: string;
}

// ── Controller accionistas — rutas HU-XXXX ────────────────────────────────────

/**
 * Controller que implementa los endpoints de HU-XXXX Limitación Funcional
 * y Acompañante Accionista.
 *
 * Rutas expuestas:
 *   GET    /api/accionistas/:id/limitacion-funcional?asamblea=
 *   POST   /api/accionistas/:id/limitacion-funcional
 *   GET    /api/accionistas/:id/acompanante?asamblea=
 *   POST   /api/accionistas/validar-acompanante
 *   POST   /api/accionistas/:id/acompanante
 *   DELETE /api/accionistas/:id/acompanante
 *
 * Rutas de reportes:
 *   GET    /api/reportes/limitacion-funcional?asamblea=
 *   GET    /api/reportes/acompanante-accionista?asamblea=
 */
@Controller('accionistas')
@UseGuards(ApiKeyGuard)
export class ParticipacionAccionistasController {
  constructor(private readonly svc: ParticipacionService) {}

  // ── Limitación Funcional ───────────────────────────────────────────────────

  /** GET /api/accionistas/:id/limitacion-funcional?asamblea= */
  @Get(':id/limitacion-funcional')
  getLimitacion(
    @Param('id') id: string,
    @Query('asamblea') asamblea: string,
  ) {
    return this.svc.getLimitacion(id, asamblea);
  }

  /**
   * POST /api/accionistas/:id/limitacion-funcional
   * Body: { asamblea, limitaciones: string[], observaciones? }
   */
  @Post(':id/limitacion-funcional')
  guardarLimitacion(
    @Param('id') id: string,
    @Body() body: GuardarLimitacionDto & { asamblea: string },
    @UsuarioActual() usuario: string,
  ) {
    return this.svc.guardarLimitacion(
      id,
      body.asamblea,
      body.limitaciones ?? [],
      body.observaciones ?? '',
      usuario,
    );
  }

  // ── Acompañante Accionista ─────────────────────────────────────────────────

  /** GET /api/accionistas/:id/acompanante?asamblea= */
  @Get(':id/acompanante')
  getAcompanante(
    @Param('id') id: string,
    @Query('asamblea') asamblea: string,
  ) {
    return this.svc.getAcompanante(id, asamblea);
  }

  /**
   * POST /api/accionistas/validar-acompanante
   * RN-04/05/06: valida DPI → existencia, acreditación, no es titular.
   * Devuelve { codigo, nombre, dpi, expediente, acreditado } para la vista previa.
   *
   * IMPORTANTE: esta ruta debe registrarse ANTES de ':id/acompanante' para
   * que NestJS no la interprete como id='validar-acompanante'.
   */
  @Post('validar-acompanante')
  validarAcompanante(
    @Body() body: ValidarAcompananteDto,
  ) {
    return this.svc.validarAcompanante(body.dpi, body.titular, body.asamblea);
  }

  /**
   * POST /api/accionistas/:id/acompanante
   * Body: { asamblea, acompanante_id }
   */
  @Post(':id/acompanante')
  guardarAcompanante(
    @Param('id') id: string,
    @Body() body: GuardarAcompananteDto,
    @UsuarioActual() usuario: string,
  ) {
    return this.svc.guardarAcompanante(id, body.asamblea, body.acompanante_id, usuario);
  }

  /** DELETE /api/accionistas/:id/acompanante — body: { asamblea } */
  @Delete(':id/acompanante')
  eliminarAcompanante(
    @Param('id') id: string,
    @Body() body: EliminarAcompananteDto,
    @UsuarioActual() usuario: string,
  ) {
    return this.svc.eliminarAcompanante(id, body.asamblea, usuario);
  }
}

// ── Controller de reportes ────────────────────────────────────────────────────

@Controller('reportes')
@UseGuards(ApiKeyGuard)
export class ReportesParticipacionController {
  constructor(private readonly svc: ParticipacionService) {}

  /**
   * GET /api/reportes/limitacion-funcional?asamblea=
   * CA-08: DPI, Nombre, Expediente, No. Gestión, Descripción de Limitación
   * Retorna CSV con BOM UTF-8 para apertura correcta en Excel español.
   */
  @Get('limitacion-funcional')
  async reporteLimitacion(
    @Query('asamblea') asamblea: string,
    @Res() res: Response,
  ) {
    const csv  = await this.svc.reporteLimitacion(asamblea);
    const bom  = Buffer.from('\uFEFF', 'utf-8');
    const body = Buffer.concat([bom, csv]);

    res.set({
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="limitacion_funcional_${asamblea || 'all'}.csv"`,
      'Content-Length':      body.length.toString(),
    });
    res.send(body);
  }

  /**
   * GET /api/reportes/acompanante-accionista?asamblea=
   * CA-09: DPI, Nombre, Expediente, No. Gestión
   */
  @Get('acompanante-accionista')
  async reporteAcompanante(
    @Query('asamblea') asamblea: string,
    @Res() res: Response,
  ) {
    const csv  = await this.svc.reporteAcompanante(asamblea);
    const bom  = Buffer.from('\uFEFF', 'utf-8');
    const body = Buffer.concat([bom, csv]);

    res.set({
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="acompanante_accionista_${asamblea || 'all'}.csv"`,
      'Content-Length':      body.length.toString(),
    });
    res.send(body);
  }
}
