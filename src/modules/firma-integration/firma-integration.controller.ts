import {
  Controller, Get, Post, Param, Body,
  Res, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { FirmaIntegrationService } from './firma-integration.service';
import { GenerarTokenFirmaDto } from './dto/firma-integration.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { IpCliente } from '../../common/decorators/usuario.decorator';

/**
 * G-09 FIX: El frontend debe llamar a ESTE proxy en lugar de ir
 * directamente al microservicio. Así la FIRMA_CORE_API_KEY nunca
 * queda expuesta en el bundle del frontend.
 *
 * G-11 FIX: Agrega los endpoints de OTP doble verificación que el
 * frontend llama para la actualización de datos personales.
 */
@Controller('firma')
@UseGuards(ApiKeyGuard)
export class FirmaIntegrationController {
  constructor(private readonly svc: FirmaIntegrationService) {}

  /**
   * POST /api/firma/token
   * Genera token OTP — usado para firma de rúbrica y actualización de datos.
   * G-09 FIX: el frontend debe llamar aquí (no directamente al microservicio).
   */
  @Post('token')
  generarToken(@Body() dto: GenerarTokenFirmaDto, @IpCliente() ip: string) {
    return this.svc.generarToken(
      {
        solicitudId:         dto.solicitudId,
        accionistaId:        dto.accionistaId,
        accionista:          dto.accionista,
        dpi:                 dto.dpi,
        accionesComunes:     dto.accionesComunes,
        accionesPreferentes: dto.accionesPreferentes,
        dividendos:          dto.dividendos,
      },
      ip,
    );
  }

  /**
   * GET /api/firma/token/:token/estado
   * G-09+G-20 FIX: el frontend debe usar este proxy para consultarEstadoFirma.
   */
  @Get('token/:token/estado')
  consultarEstado(@Param('token') token: string) {
    return this.svc.consultarEstadoToken(token);
  }

  /**
   * GET /api/firma/imagen/:id
   * Recupera imagen de firma para auditoría.
   */
  @Get('imagen/:id')
  async obtenerImagen(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const firma = await this.svc.obtenerFirma(id);
    res.set({
      'Content-Type':   firma.contentType,
      'Content-Length': firma.buffer.length.toString(),
      'Cache-Control':  'private, max-age=3600',
    });
    res.send(firma.buffer);
  }

  /** GET /api/firma/health */
  @Get('health')
  healthCheck() { return this.svc.healthCheck(); }

  // ── G-11 FIX: OTP doble verificación (actualización datos personales) ─────

  /**
   * POST /api/accionistas/:id/solicitar-verificacion
   * Genera tokens OTP (SMS + email) para verificar identidad antes de
   * actualizar datos personales. El microservicio de firma maneja el OTP;
   * este endpoint actúa como proxy y usa el mismo token para ambos canales
   * (en producción se puede integrar con un servicio de SMS externo).
   *
   * Nota: el frontend espera { ok: true, mensaje, _demo_token }
   */
  @Post('/otp/:accId/solicitar')
  async solicitarOTP(
    @Param('accId') accId: string,
    @Body() body: { telefono?: string; email?: string },
    @IpCliente() ip: string,
  ) {
    return this.svc.solicitarOTPDoble(accId, body.telefono ?? '', body.email ?? '', ip);
  }

  /**
   * POST /api/accionistas/:id/verificar-tokens
   * Verifica los dos códigos OTP enviados por SMS y email.
   */
  @Post('/otp/:accId/verificar')
  async verificarOTP(
    @Param('accId') accId: string,
    @Body() body: { token_sms?: string; token_email?: string },
  ) {
    return this.svc.verificarOTPDoble(accId, body.token_sms ?? '', body.token_email ?? '');
  }
}

/**
 * Controller secundario que expone los endpoints exactos que llama el frontend.
 * G-11 FIX: el frontend llama a /accionistas/:id/solicitar-verificacion
 */
@Controller('accionistas')
@UseGuards(ApiKeyGuard)
export class AccionistasOtpController {
  constructor(private readonly svc: FirmaIntegrationService) {}

  @Post(':id/solicitar-verificacion')
  async solicitar(
    @Param('id') id: string,
    @Body() body: { telefono?: string; email?: string },
    @IpCliente() ip: string,
  ) {
    return this.svc.solicitarOTPDoble(id, body.telefono ?? '', body.email ?? '', ip);
  }

  @Post(':id/verificar-tokens')
  async verificar(
    @Param('id') id: string,
    @Body() body: { token_sms?: string; token_email?: string },
  ) {
    return this.svc.verificarOTPDoble(id, body.token_sms ?? '', body.token_email ?? '');
  }
}
