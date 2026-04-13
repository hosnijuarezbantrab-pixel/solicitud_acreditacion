import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * AC.ACCASAMBLEA_ACTUAL
 * Asambleas activas con sus rangos de fechas de entrega.
 * Usada para:
 *  - Validar período de acreditación (P_REGISTRO_ASAMBLEA_NUEVO)
 *  - Listar asambleas en ACCFRM0081
 *  - Validar rangos de credencial en ACCFRM0080
 */
@Entity({ name: 'ACCASAMBLEA_ACTUAL', schema: 'AC' })
export class AsambleaActual {
  @PrimaryColumn({ name: 'TIPO_ASAMBLEA', type: 'varchar2', length: 1 })
  tipoAsamblea: string;  // 'O'=Ordinaria | 'E'=Extraordinaria

  @PrimaryColumn({ name: 'ASAMBLEA', type: 'varchar2', length: 10 })
  asamblea: string;

  @Column({ name: 'FECHA_ASAMBLEA', type: 'date', nullable: true })
  fechaAsamblea: Date;

  /** 'S'=Activa, 'N'=Inactiva */
  @Column({ name: 'ESTADO_ASAMBLEA', type: 'varchar2', length: 1, nullable: true })
  estadoAsamblea: string;

  // Rango de entrega de expedientes (usado en validación R7 ACCFRM0080)
  @Column({ name: 'FECHA_ENTREGAEXPED_DESDE', type: 'date', nullable: true })
  fechaEntregaExpdDesde: Date;

  @Column({ name: 'FECHA_ENTREGAEXPED_HASTA', type: 'date', nullable: true })
  fechaEntregaExpdHasta: Date;

  // Rango de entrega de credenciales (usado en validación R10 ACCFRM0080)
  @Column({ name: 'FECHA_ENTREGACRED_DESDE', type: 'date', nullable: true })
  fechaEntregaCredDesde: Date;

  @Column({ name: 'FECHA_ENTREGACRED_HASTA', type: 'date', nullable: true })
  fechaEntregaCredHasta: Date;

  @Column({ name: 'FECHA_ENTREGACARTAS_DESDE', type: 'date', nullable: true })
  fechaEntregaCartasDesde: Date;

  @Column({ name: 'FECHA_ENTREGACARTAS_HASTA', type: 'date', nullable: true })
  fechaEntregaCartasHasta: Date;

  @Column({ name: 'FECHA_RECEPEXPED_DESDE', type: 'date', nullable: true })
  fechaRecepExpdDesde: Date;

  @Column({ name: 'FECHA_RECEPEXPED_HASTA', type: 'date', nullable: true })
  fechaRecepExpdHasta: Date;

  @Column({ name: 'NUMERO_CORRELATIVO_BIT_AUT', type: 'number', nullable: true })
  numeroCorrelativoBitAut: number;

  @Column({ name: 'IND_CONFLICTO_INTERES', type: 'varchar2', length: 1, default: 'N' })
  indConflictoInteres: string;

  @Column({ name: 'HORA_INICIO_ENT_EXP', type: 'date', nullable: true })
  horaInicioEntExp: Date;

  @Column({ name: 'HORA_CIERRE_ENT_EXP', type: 'date', nullable: true })
  horaCierreEntExp: Date;

  @Column({ name: 'FECHA_CREADA', type: 'date', nullable: true })
  fechaCreada: Date;
}
