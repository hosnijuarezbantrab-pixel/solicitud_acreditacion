import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * AC.ACCACCIONISTA
 * Tabla principal de accionistas.
 * Campos de solo lectura en el frontend (provienen de RENAP / core bancario):
 *   nombre, numero_dpi, fecha_nacimiento, genero, estado_civil,
 *   actividad_economica, profesion, nivel_estudios, nit
 */
@Entity({ name: 'ACCACCIONISTA', schema: 'AC' })
export class Accionista {
  @PrimaryColumn({ name: 'ACCIONISTA', type: 'varchar2', length: 15 })
  accionista: string;

  /** Nombre completo (persona natural) */
  @Column({ name: 'NOMBRE', type: 'varchar2', length: 80, nullable: true })
  nombre: string;

  /** Razón social (persona jurídica) */
  @Column({ name: 'ACCRAZON', type: 'varchar2', length: 100, nullable: true })
  accRazon: string;

  /** Tipo de persona: '1'=Natural, '2'=Jurídica */
  @Column({ name: 'ACCTIPPER', type: 'varchar2', length: 1, nullable: true })
  accTipper: string;

  @Column({ name: 'ACCPRINOM', type: 'varchar2', length: 20, nullable: true })
  primerNombre: string;

  @Column({ name: 'ACCSEGNOM', type: 'varchar2', length: 20, nullable: true })
  segundoNombre: string;

  @Column({ name: 'ACCPRIAPE', type: 'varchar2', length: 20, nullable: true })
  primerApellido: string;

  @Column({ name: 'ACCSEGAPE', type: 'varchar2', length: 20, nullable: true })
  segundoApellido: string;

  @Column({ name: 'ACCCASAPE', type: 'varchar2', length: 20, nullable: true })
  apellidoCasada: string;

  @Column({ name: 'NUMERO_DPI', type: 'varchar2', length: 13, nullable: true })
  numeroDpi: string;

  @Column({ name: 'ACCNIT', type: 'varchar2', length: 12, nullable: true })
  nit: string;

  /** 21=Activo, 31=Suspendido, 99=Inactivo, 3=No válido */
  @Column({ name: 'ESTATUS_ACCIONISTA', type: 'number', nullable: true })
  estatusAccionista: number;

  @Column({ name: 'FECHA_NACIMIENTO_ACCIONISTA', type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ name: 'ACCGENERO', type: 'varchar2', length: 1, nullable: true })
  genero: string;

  // Dirección
  @Column({ name: 'DIRECCION', type: 'varchar2', length: 160, nullable: true })
  direccion: string;

  @Column({ name: 'ZONA', type: 'number', nullable: true })
  zona: number;

  @Column({ name: 'FINCODPAIS', type: 'number', nullable: true })
  codPais: number;

  @Column({ name: 'FINCODDEPTO', type: 'number', nullable: true })
  codDepto: number;

  @Column({ name: 'FINCODCIUDAD', type: 'number', nullable: true })
  codMunicipio: number;

  // Contacto
  @Column({ name: 'TELEFONO', type: 'varchar2', length: 30, nullable: true })
  telefono: string;

  @Column({ name: 'ACC_CORREO_ELECTRONICO', type: 'varchar2', length: 100, nullable: true })
  correoElectronico: string;

  // Acciones
  @Column({ name: 'CANTIDAD_ACCIONES', type: 'number', default: 0 })
  cantidadAcciones: number;

  @Column({ name: 'CANTIDAD_ACCIONES_PREF', type: 'number', nullable: true })
  cantidadAccionesPref: number;

  // Auditoría
  @Column({ name: 'FECHA_ACTU', type: 'date', nullable: true })
  fechaActu: Date;

  @Column({ name: 'USUARIO_ACTU', type: 'varchar2', length: 30, nullable: true })
  usuarioActu: string;

  @Column({ name: 'FECHA_CREA', type: 'date', nullable: true })
  fechaCrea: Date;
}
