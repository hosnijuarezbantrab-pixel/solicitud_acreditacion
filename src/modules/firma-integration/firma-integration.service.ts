import {
  Injectable, Logger, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface GenerarTokenPayload {
  solicitudId: string;
  accionistaId: string;
  accionista: string;
  dpi: string;
  accionesComunes?: number;
  accionesPreferentes?: number;
  dividendos?: string;
}

export interface TokenGeneradoResponse {
  token: string;
  solicitudId: string;
  accionistaId: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface EstadoTokenResponse {
  token: string;
  estado: 'ACTIVO' | 'USADO' | 'EXPIRADO' | 'NO_ENCONTRADO';
  solicitudId: string;
  accionistaId: string;
  expiresAt: string;
  ttlRemainingSeconds: number;
  source: 'redis' | 'oracle';
}

/**
 * FirmaIntegrationService
 *
 * Cliente HTTP hacia el microservicio de firma digital (firma-accionistas-backend).
 * Expone las operaciones del sistema Core: generar token y consultar estado.
 *
 * El microservicio de firma corre en FIRMA_SERVICE_URL (default: http://localhost:3002).
 * La autenticación usa X-Core-Key (FIRMA_CORE_API_KEY).
 *
 * Flujo completo de firma para actualización de datos (ACCFRM0803):
 *   1. Frontend solicita guardar datos editables
 *   2. Este servicio genera un token OTP → el microservicio lo persiste y lo cachea
 *   3. El microservicio envía el token al accionista (SMS + email — gestionado externamente)
 *   4. El accionista ingresa los dos códigos en el frontend
 *   5. El frontend llama directamente al microservicio para verificar (ruta de tablet)
 *   6. Una vez verificado, el frontend llama a PATCH /accionistas/:id/datos-editables
 *
 * Flujo de firma de rúbrica para acreditación:
 *   1. Se genera token para la sesión de firma
 *   2. La tablet muestra términos y captura la rúbrica
 *   3. La tablet sube la firma al microservicio (POST /guardar-firma)
 *   4. Este servicio puede consultar el estado y recuperar la firma
 */
@Injectable()
export class FirmaIntegrationService {
  private readonly logger = new Logger(FirmaIntegrationService.name);
  private readonly http: AxiosInstance;

  constructor() {
    const baseURL = process.env.FIRMA_SERVICE_URL || 'http://localhost:3002';
    const apiKey  = process.env.FIRMA_CORE_API_KEY || 'dev-core-key';

    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        'Content-Type':  'application/json',
        'X-Core-Key':    apiKey,
      },
    });

    // Log de errores de red
    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        this.logger.error(
          `Firma microservicio error [${err.config?.method?.toUpperCase()} ${err.config?.url}]: ` +
          `${err.response?.status} — ${JSON.stringify(err.response?.data)}`,
        );
        return Promise.reject(err);
      },
    );
  }

  // ── Generar Token OTP ─────────────────────────────────────────────────────

  /**
   * Genera un token OTP de 6 dígitos para verificación de identidad.
   * Llama a GET /api/firma-accionistas/generar-token en el microservicio.
   *
   * El token se envía al accionista por SMS + email (gestionado por el microservicio
   * o por un servicio externo de notificaciones).
   *
   * @param payload  Datos del accionista (accionistaId, dpi, acciones, dividendos)
   * @param ipOrigen IP del solicitante para auditoría
   */
  async generarToken(
    payload: GenerarTokenPayload,
    ipOrigen?: string,
  ): Promise<TokenGeneradoResponse> {
    try {
      const { data } = await this.http.get('/api/firma-accionistas/generar-token', {
        params: payload,
        headers: ipOrigen ? { 'X-Forwarded-For': ipOrigen } : {},
      });

      this.logger.log(
        `Token OTP generado para accionista ${payload.accionistaId} / solicitud ${payload.solicitudId}`,
      );

      return data?.data ?? data;
    } catch (err) {
      if (err.response?.status === 400) {
        throw new BadRequestException(
          `Error generando token: ${err.response.data?.message ?? 'Solicitud inválida'}`,
        );
      }
      throw new InternalServerErrorException(
        'Error de comunicación con el servicio de firma. Intente nuevamente.',
      );
    }
  }

  // ── Consultar Estado de Token ─────────────────────────────────────────────

  /**
   * Consulta el estado de un token sin consumirlo (solo lectura).
   * Llama a GET /api/firma-accionistas/consultar-token/:token.
   * Lee de Redis primero; Oracle como fallback.
   */
  async consultarEstadoToken(token: string): Promise<EstadoTokenResponse> {
    try {
      const { data } = await this.http.get(
        `/api/firma-accionistas/consultar-token/${token}`,
      );
      return data?.data ?? data;
    } catch (err) {
      throw new InternalServerErrorException(
        'Error consultando estado del token de firma.',
      );
    }
  }

  // ── Consultar Firma ───────────────────────────────────────────────────────

  /**
   * Obtiene la imagen de firma almacenada para auditoría.
   * Retorna el buffer de la imagen para que el controlador la sirva.
   */
  async obtenerFirma(
    idFirma: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const res = await this.http.get(
        `/api/firma-accionistas/firma/${idFirma}`,
        { responseType: 'arraybuffer' },
      );
      return {
        buffer:      Buffer.from(res.data),
        contentType: res.headers['content-type'] ?? 'image/png',
      };
    } catch (err) {
      if (err.response?.status === 404) {
        throw new BadRequestException(`Firma ${idFirma} no encontrada.`);
      }
      throw new InternalServerErrorException('Error obteniendo firma del servicio.');
    }
  }

  // ── Health Check ──────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ disponible: boolean; url: string }> {
    try {
      await this.http.get('/health', { timeout: 3000 });
      return { disponible: true, url: process.env.FIRMA_SERVICE_URL || 'http://localhost:3002' };
    } catch {
      return { disponible: false, url: process.env.FIRMA_SERVICE_URL || 'http://localhost:3002' };
    }
  }
}

  // ── G-11 FIX: OTP doble verificación ─────────────────────────────────────

  /**
   * Genera token OTP para doble verificación (SMS + email).
   * Usa el mismo microservicio de firma; en este flujo el token de 6 dígitos
   * sirve como código único para ambos canales.
   */
  async solicitarOTPDoble(
    accId: string,
    telefono: string,
    email: string,
    ipOrigen?: string,
  ): Promise<{ ok: boolean; mensaje: string; _demo_token?: string }> {
    try {
      const solicitudId = `OTP-${accId}-${Date.now()}`;
      const res = await this.generarToken(
        { solicitudId, accionistaId: accId, accionista: accId, dpi: '' },
        ipOrigen,
      );

      this.logger.log(`OTP doble generado para accionista ${accId} → tel ${telefono}, email ${email}`);

      return {
        ok: true,
        mensaje: 'Códigos enviados correctamente.',
        // En producción NO retornar el token — solo en demo
        ...(process.env.NODE_ENV !== 'production' && { _demo_token: res.token }),
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Verifica los dos tokens OTP (SMS + email).
   * En esta implementación ambos tokens deben ser iguales (mismo código generado).
   * En producción se puede generar un token distinto por canal.
   */
  async verificarOTPDoble(
    accId: string,
    tokenSms: string,
    tokenEmail: string,
  ): Promise<{ ok: boolean }> {
    if (!tokenSms || !tokenEmail) {
      throw new (await import('@nestjs/common').then(m => m.BadRequestException))(
        'Ambos códigos son requeridos.',
      );
    }
    // Ambos tokens deben coincidir (mismo código en este flujo simplificado)
    if (tokenSms !== tokenEmail) {
      throw new (await import('@nestjs/common').then(m => m.BadRequestException))(
        'Los códigos no coinciden. Verifique e intente nuevamente.',
      );
    }
    // Verificar contra el microservicio de firma
    const estado = await this.consultarEstadoToken(tokenSms);
    if (estado.estado !== 'ACTIVO') {
      throw new (await import('@nestjs/common').then(m => m.BadRequestException))(
        estado.estado === 'USADO'
          ? 'Los códigos ya fueron utilizados.'
          : 'Los códigos han expirado. Solicite nuevos códigos.',
      );
    }
    return { ok: true };
  }
