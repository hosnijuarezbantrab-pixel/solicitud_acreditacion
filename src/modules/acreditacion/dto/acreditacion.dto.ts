import {
  IsString, IsNumber, IsOptional, IsIn, IsNotEmpty, Min, Length, IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * G-07 FIX: RegistrarAcreditacionDto ahora acepta el payload exacto
 * que envía AcreditacionWizard.confirmar():
 *   { accionista: acc.codigo, cod_estado: estado, asambleas: asmSel }
 *
 * tipoDocemitido y nombreAccionista se derivan internamente si no vienen.
 */
export class RegistrarAcreditacionDto {
  @IsString() @IsNotEmpty() @Length(1, 15)
  accionista: string;

  // El frontend envía cod_estado — alias de codEstado
  @IsNumber() @IsOptional() @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  cod_estado?: number;

  @IsNumber() @IsOptional() @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  codEstado?: number;

  // nombreAccionista es opcional — el servicio lo busca si no viene
  @IsString() @IsOptional()
  nombreAccionista?: string;

  /**
   * Lista de asambleas seleccionadas (enviada por el frontend).
   * El servicio la usa cuando está presente; si no, usa todas las activas.
   * Cada elemento puede tener { id, num, tipo, asamblea, tipoAsamblea }
   */
  @IsArray() @IsOptional()
  asambleas?: Array<{ id?: string; num?: string; tipo?: string; asamblea?: string; tipoAsamblea?: string }>;

  @IsNumber() @IsOptional() @Min(1) @Transform(({ value }) => value !== undefined ? Number(value) : 1)
  tipoDocemitido?: number;

  @IsString() @IsOptional()
  usuarioCrea?: string;

  @IsNumber() @IsOptional() @Transform(({ value }) => value ? Number(value) : null)
  codigoSedeEntrega?: number;

  @IsOptional() @IsIn(['S', 'N'])
  autorizaAntecedentes?: string;
}

export class ResultadoAcreditacionDto {
  asamblea: string;
  tipoAsamblea: string;
  descripcionAsamblea: string;
  expediente: number;
  credencial: number;
  estadoExpediente: number;
  fechaEntrega: string;
  fecha_entrega: string;    // G-08 FIX: alias snake_case para el frontend
  fechaCrea: string;
}

export class AcreditacionResponseDto {
  accionista: string;
  nombreAccionista: string;
  tipoDocemitido: number;
  correlativos: ResultadoAcreditacionDto[];
  expedientes: ResultadoAcreditacionDto[];  // G-08 FIX: alias de correlativos
  mensaje: string;
}

export class ActualizarExpedienteDto {
  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value))
  estadoExpediente?: number;

  @IsString() @IsOptional()
  autorizaUltimoEstado?: string;

  @IsOptional() @IsIn(['S', 'N']) checkFecEntregado?: string;
  @IsOptional() @IsIn(['S', 'N']) checkFecRecibido?: string;
  @IsOptional() @IsIn(['S', 'N']) checkCredencial?: string;
  @IsOptional() @IsIn(['S', 'N']) autorizaAntecedentes?: string;

  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value)) votosPropios?: number;
  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value)) votosAjenos?: number;
  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value)) votosConsignados?: number;
  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value)) votosNulos?: number;
  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value)) desdeCarta?: number;
  @IsNumber() @IsOptional() @Transform(({ value }) => Number(value)) hastaCarta?: number;
  @IsOptional() @IsIn(['S', 'N']) ejercioVoto?: string;

  @IsString() @IsNotEmpty()
  usuarioActu: string;
}

export class RegistrarMotivoRechazoDto {
  @IsString() @IsNotEmpty()
  codigoMotivo: string;

  @IsString() @IsOptional()
  observaciones?: string;

  @IsString() @IsNotEmpty()
  usuarioCrea: string;
}

export class ImprimirCredencialDto {
  @IsString() @IsOptional()
  usuarioAutoriza?: string;

  @IsString() @IsNotEmpty()
  usuarioImpresion: string;
}
