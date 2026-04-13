import { IsString, IsEmail, IsOptional, IsNumber, Length } from 'class-validator';
import { Transform } from 'class-transformer';

/** Búsqueda por DPI — ACCFRM0803 */
export class BuscarPorDpiDto {
  @IsString()
  @Length(5, 13)
  @Transform(({ value }) => String(value).trim())
  dpi: string;
}

/**
 * Actualización de campos editables.
 * G-17 FIX: renombrados para coincidir con lo que envía DatosPersonalesForm.
 * Los campos de solo lectura (nombre, DPI, NIT, etc.) nunca se reciben aquí.
 */
export class ActualizarDatosEditablesDto {
  @IsOptional() @IsEmail()               correoElectronico?: string;
  @IsOptional() @IsString()              email?: string;          // alias frontend
  @IsOptional() @IsString()              telefono?: string;
  @IsOptional() @IsString()              tel_celular?: string;    // alias frontend
  @IsOptional() @IsString()              tel_casa?: string;
  @IsOptional() @IsString()              tel_trabajo?: string;

  // Dirección
  @IsOptional() @IsString()              pais?: string;
  @IsOptional() @IsNumber() @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
                                         codPais?: number;
  @IsOptional() @IsString()              cod_depto?: string;
  @IsOptional() @IsNumber() @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
                                         codDepto?: number;
  @IsOptional() @IsString()              cod_municipio?: string;
  @IsOptional() @IsNumber() @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
                                         codMunicipio?: number;
  @IsOptional() @IsString() @Length(1, 160) direccion?: string;
  @IsOptional()              zona?: any;
  @IsOptional() @IsString()              lugar_trabajo?: string;
}

/**
 * G-04 FIX: Respuesta del accionista alineada con los nombres de campo
 * que usa el frontend (mockData, AccionistaHeader, DatosPersonalesForm, etc.)
 *
 * Campos del frontend → campo del backend:
 *   codigo              ← accionista (PK)
 *   estatus             ← estatusAccionista
 *   acciones_comunes    ← cantidadAcciones
 *   acciones_preferentes_a ← cantidadAccionesPref
 *   ultima_actualizacion   ← fechaActu formateada
 *   fecha_actu_iso         ← fechaActu ISO
 *   email               ← correoElectronico
 *   tel_celular         ← telefono (único campo en DB)
 */
export class AccionistaResponseDto {
  // Identificadores — ambos nombres para compatibilidad
  accionista:            string;
  codigo:                string;    // alias de accionista (G-04)

  nombre:                string;
  iniciales:             string;

  // DPI/NIT
  dpi:                   string;
  nit:                   string;

  // Estatus — ambos nombres
  estatusAccionista:     number;
  estatus:               number;    // alias (G-04)
  estatusDesc:           string;
  descripEstatus:        string;    // alias (G-04)

  // Datos demográficos (solo lectura)
  fechaNacimiento:       string;
  fecha_nacimiento:      string;    // alias
  genero:                string;
  generoDesc:            string;
  apellidoCasada:        string;
  primerNombre:          string;
  segundoNombre:         string;
  primerApellido:        string;
  segundoApellido:       string;

  // Contacto editable
  correoElectronico:     string;
  email:                 string;    // alias (G-04)
  telefono:              string;
  tel_celular:           string;    // alias (G-04)
  tel_casa:              string;    // siempre vacío (un solo campo en DB)
  tel_trabajo:           string;    // siempre vacío

  // Dirección editable
  codPais:               number;
  cod_depto:             string;    // alias string para compatibilidad
  codDepto:              number;
  cod_municipio:         string;    // alias
  codMunicipio:          number;
  direccion:             string;
  zona:                  any;

  // Acciones
  cantidadAcciones:      number;
  acciones_comunes:      number;    // alias (G-04)
  cantidadAccionesPref:  number;
  acciones_preferentes_a: number;  // alias (G-04)

  // Dividendos (calculado — ver AccionistasService)
  dividendos:            number;    // G-18 FIX: agregado

  // Vigencia
  fechaActu:             string;
  ultima_actualizacion:  string;   // alias formateado es-GT (G-04)
  fecha_actu_iso:        string;   // alias ISO (G-04)
  vigente:               boolean;
  mesesDesdeActualizacion: number;

  // Campos no editables adicionales que usa DatosPersonalesForm
  actividad_economica:   string;
  profesion:             string;
  nivel_estudios:        string;
  lugar_trabajo:         string;
  patrono_nombre:        string;
  estado_civil:          string;
  proveedor_bantrab:     string;
  empleado_bantrab:      string;
  pariente_id:           string;
}
