import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * AC.ACCASAMBLEA
 * Tabla principal de expedientes de acreditación.
 * PK: (TIPO_ASAMBLEA, ASAMBLEA, EXPEDIENTE, TIPO_DOCEMITIDO)
 *
 * Estado del expediente:
 *   1 = Entregado
 *   2 = Recibido       ← estado inicial al crear (PRC_INSERTA_ASAMBLEA_C)
 *   4 = Aprobado
 *   5 = En Revisión
 *   6 = Credencial a Emitir
 *   8 = Credencial Entregada
 *  10 = Denegado
 */
@Entity({ name: 'ACCASAMBLEA', schema: 'AC' })
export class Accasamblea {
  @PrimaryColumn({ name: 'TIPO_ASAMBLEA', type: 'varchar2', length: 1 })
  tipoAsamblea: string;

  @PrimaryColumn({ name: 'ASAMBLEA', type: 'varchar2', length: 10 })
  asamblea: string;

  @PrimaryColumn({ name: 'EXPEDIENTE', type: 'number' })
  expediente: number;

  @PrimaryColumn({ name: 'TIPO_DOCEMITIDO', type: 'number' })
  tipoDocemitido: number;

  @Column({ name: 'ACCIONISTA', type: 'varchar2', length: 15 })
  accionista: string;

  @Column({ name: 'ESTADO_EXPEDIENTE', type: 'number' })
  estadoExpediente: number;

  @Column({ name: 'CREDENCIAL', type: 'number', nullable: true })
  credencial: number;

  @Column({ name: 'VOTOS_PROPIOS', type: 'number', nullable: true, default: 0 })
  votosPropios: number;

  @Column({ name: 'VOTOS_AJENOS', type: 'number', nullable: true, default: 0 })
  votosAjenos: number;

  @Column({ name: 'VOTOS_CONSIGNADOS', type: 'number', nullable: true, default: 0 })
  votosConsignados: number;

  @Column({ name: 'VOTOS_NULOS', type: 'number', nullable: true, default: 0 })
  votosNulos: number;

  @Column({ name: 'CANTIDAD_REPRESENTADOS', type: 'number', nullable: true, default: 0 })
  cantidadRepresentados: number;

  @Column({ name: 'DESDE_CARTA', type: 'number', nullable: true, default: 0 })
  desdeCarta: number;

  @Column({ name: 'HASTA_CARTA', type: 'number', nullable: true, default: 0 })
  hastaCarta: number;

  @Column({ name: 'EJERCIO_VOTO', type: 'varchar2', length: 1, nullable: true })
  ejercioVoto: string;

  @Column({ name: 'FECHA_ASAMBLEA', type: 'date', nullable: true })
  fechaAsamblea: Date;

  @Column({ name: 'FECHA_CREA', type: 'date', nullable: true })
  fechaCrea: Date;

  @Column({ name: 'FECHA_ENTREGA', type: 'date', nullable: true })
  fechaEntrega: Date;

  @Column({ name: 'FECHA_RECIBIDO', type: 'date', nullable: true })
  fechaRecibido: Date;

  @Column({ name: 'FECHA_CAMBIOESTADO', type: 'date', nullable: true })
  fechaCambioestado: Date;

  @Column({ name: 'FECHA_CREDENCIAL', type: 'date', nullable: true })
  fechaCredencial: Date;

  @Column({ name: 'NOMBRE_NO_ACCIONISTA', type: 'varchar2', length: 80, nullable: true })
  nombreNoAccionista: string;

  @Column({ name: 'ESTADO_IMPRESION', type: 'char', length: 1, nullable: true })
  estadoImpresion: string;

  @Column({ name: 'ESTADO_REIMPRESION', type: 'varchar2', length: 1, nullable: true })
  estadoReimpresion: string;

  @Column({ name: 'AUTORIZA_ANTECEDENTES', type: 'char', length: 1, nullable: true })
  autorizaAntecedentes: string;

  @Column({ name: 'AUTORIZA_ULTIMO_ESTADO', type: 'varchar2', length: 30, nullable: true })
  autorizaUltimoEstado: string;

  @Column({ name: 'SEDE', type: 'number', nullable: true })
  sede: number;

  @Column({ name: 'CODIGO_SEDE_ENTREGA', type: 'number', nullable: true })
  codigoSedeEntrega: number;

  @Column({ name: 'USUARIO_CREA', type: 'varchar2', length: 30, nullable: true })
  usuarioCrea: string;

  @Column({ name: 'USUARIO_ACTU', type: 'varchar2', length: 30, nullable: true })
  usuarioActu: string;

  @Column({ name: 'FECHA_ACTU', type: 'date', nullable: true })
  fechaActu: Date;

  @Column({ name: 'USUARIO_ENTREGACRED', type: 'varchar2', length: 30, nullable: true })
  usuarioEntregacred: string;
}
