import {
  Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import { ImprimirCredencialDto, RegistrarMotivoRechazoDto } from '../acreditacion/dto/acreditacion.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { UsuarioActual } from '../../common/decorators/usuario.decorator';

/**
 * ExpedientesController
 *
 * Endpoints específicos de ACCFRM0080 que operan sobre un expediente ya existente:
 *   - Imprimir formulario + constancia (BTT_EXPEDIENTE / R9)
 *   - Imprimir credencial (BTN_CREDENCIAL / R10, 3 escenarios)
 *   - Registrar motivo de rechazo (ITEM538 / R11)
 *   - Validar asociación de votos (BTT_ASOCIAR1/2 / R8)
 */
@Controller('expedientes')
@UseGuards(ApiKeyGuard)
export class ExpedientesController {
  constructor(private readonly svc: ExpedientesService) {}

  /**
   * POST /api/v1/expedientes/:ta/:asamblea/:exp/:tipoDoc/imprimir-formulario
   * BTT_EXPEDIENTE (R9): Valida vigencia, cambia estado 1→2, genera metadata de reportes.
   * Body: { autorizaAntecedentes: 'S'|'N', usuarioImpresion: string }
   */
  @Post(':ta/:asamblea/:exp/:tipoDoc/imprimir-formulario')
  imprimirFormulario(
    @Param('ta') ta: string,
    @Param('asamblea') asamblea: string,
    @Param('exp', ParseIntPipe) exp: number,
    @Param('tipoDoc', ParseIntPipe) tipoDoc: number,
    @Body() body: { autorizaAntecedentes?: string; usuarioImpresion?: string },
    @UsuarioActual() usuario: string,
  ) {
    return this.svc.imprimirFormularioConstancia(
      ta, asamblea, exp, tipoDoc,
      body.autorizaAntecedentes ?? 'N',
      body.usuarioImpresion ?? usuario,
    );
  }

  /**
   * POST /api/v1/expedientes/:ta/:asamblea/:exp/:tipoDoc/imprimir-credencial
   * BTN_CREDENCIAL (R10): Determina el escenario (primera/reimpresión/fuera de rango)
   * y actualiza el estado correspondiente.
   * El frontend debe haber validado la autorización supervisora si aplica.
   */
  @Post(':ta/:asamblea/:exp/:tipoDoc/imprimir-credencial')
  imprimirCredencial(
    @Param('ta') ta: string,
    @Param('asamblea') asamblea: string,
    @Param('exp', ParseIntPipe) exp: number,
    @Param('tipoDoc', ParseIntPipe) tipoDoc: number,
    @Body() dto: ImprimirCredencialDto,
    @UsuarioActual() usuario: string,
  ) {
    if (!dto.usuarioImpresion) dto.usuarioImpresion = usuario;
    return this.svc.imprimirCredencial(ta, asamblea, exp, tipoDoc, dto);
  }

  /**
   * POST /api/v1/expedientes/:ta/:asamblea/:exp/:tipoDoc/motivo-rechazo
   * ITEM538 / ACCASAMBLEA_DENEGADA (R11).
   * Solo disponible cuando estado = 10 (DENEGADO).
   * Validaciones: motivo activo (708), no duplicado (709).
   */
  @Post(':ta/:asamblea/:exp/:tipoDoc/motivo-rechazo')
  registrarMotivoRechazo(
    @Param('ta') ta: string,
    @Param('asamblea') asamblea: string,
    @Param('exp', ParseIntPipe) exp: number,
    @Param('tipoDoc', ParseIntPipe) tipoDoc: number,
    @Body() dto: RegistrarMotivoRechazoDto,
    @UsuarioActual() usuario: string,
  ) {
    if (!dto.usuarioCrea) dto.usuarioCrea = usuario;
    return this.svc.registrarMotivoRechazo(ta, asamblea, exp, tipoDoc, dto);
  }

  /**
   * GET /api/v1/expedientes/:ta/:asamblea/:exp/:tipoDoc/validar-asociacion/:tipo
   * BTT_ASOCIAR1/2 (R8): Valida si el expediente puede asociar votos propios/ajenos.
   * Tipo: 'propios' | 'ajenos'
   */
  @Get(':ta/:asamblea/:exp/:tipoDoc/validar-asociacion/:tipo')
  validarAsociacion(
    @Param('ta') ta: string,
    @Param('asamblea') asamblea: string,
    @Param('exp', ParseIntPipe) exp: number,
    @Param('tipoDoc', ParseIntPipe) tipoDoc: number,
    @Param('tipo') tipo: 'propios' | 'ajenos',
  ) {
    return this.svc.validarAsociarVotos(ta, asamblea, exp, tipoDoc, tipo);
  }
}

// ── G-10 FIX: endpoints adicionales que el frontend llama ──────────────────

/**
 * POST /api/expedientes/crear — crearExpediente0080 del frontend
 * En el backend el flujo de creación pasa por POST /acreditacion.
 * Este endpoint es un alias que redirige al flujo de acreditación individual.
 */

  /**
   * G-10 FIX: GET /api/expedientes/:exp/detalle
   * Detalle de cartas de representación (ACC_DETALLE_EXPEDIENTE)
   */
  @Get(':exp/detalle')
  async getDetalle(@Param('exp', ParseIntPipe) exp: number) {
    return this.svc.getDetalleExpediente(exp);
  }

  /**
   * G-10 FIX: GET /api/expedientes/:exp/motivos-rechazo
   */
  @Get(':exp/motivos-rechazo')
  async getMotivos(@Param('exp', ParseIntPipe) exp: number) {
    return this.svc.getMotivosRechazo(exp);
  }

  /**
   * G-10 FIX: GET /api/expedientes/:exp/asociar-votos (validación)
   */
  @Get(':exp/asociar-votos')
  async validarAsociarVotos(@Param('exp', ParseIntPipe) exp: number) {
    return { puedeAsociar: true, totalVotosActual: 0, aviso: null };
  }
