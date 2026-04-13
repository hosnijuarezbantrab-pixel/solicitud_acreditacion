import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para generar token OTP de verificación de identidad.
 * Llamado por el sistema Core cuando el accionista quiere actualizar sus datos
 * o antes de capturar la rúbrica de acreditación.
 */
export class GenerarTokenFirmaDto {
  /** ID de la solicitud/transacción (ej: código de expediente o UUID interno) */
  @IsString()
  @IsNotEmpty()
  solicitudId: string;

  /** Código del accionista (PK de ACCACCIONISTA) */
  @IsString()
  @IsNotEmpty()
  accionistaId: string;

  /** Nombre completo del accionista (se cachea en Redis para evitar round-trips) */
  @IsString()
  @IsNotEmpty()
  accionista: string;

  /** DPI del accionista (para mostrar en la tablet con máscara) */
  @IsString()
  @IsNotEmpty()
  dpi: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  accionesComunes?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  accionesPreferentes?: number;

  @IsOptional()
  @IsString()
  dividendos?: string;
}

/** DTO para consultar estado de un token */
export class ConsultarTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
