import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * AC.ACC_DETINVERSION_ASAMBLEA
 * Detalle de inversión por tipo de documento del accionista en la asamblea.
 * PK: (TIPO_ASAMBLEA, ASAMBLEA, ACCIONISTA, EXPEDIENTE, TIPO_DOCUMEN)
 *
 * Se actualiza con el correlativo al finalizar la acreditación
 * (equivale al loop de ACC_DETINVERSION_ASAMBLEA en PRC_INSERTA_ASAMBLEA_C).
 */
@Entity({ name: 'ACC_DETINVERSION_ASAMBLEA', schema: 'AC' })
export class AccDetinversionAsamblea {
  @PrimaryColumn({ name: 'TIPO_ASAMBLEA', type: 'varchar2', length: 1 })
  tipoAsamblea: string;

  @PrimaryColumn({ name: 'ASAMBLEA', type: 'varchar2', length: 10 })
  asamblea: string;

  @PrimaryColumn({ name: 'ACCIONISTA', type: 'varchar2', length: 15 })
  accionista: string;

  @PrimaryColumn({ name: 'EXPEDIENTE', type: 'number' })
  expediente: number;

  @PrimaryColumn({ name: 'TIPO_DOCUMEN', type: 'number' })
  tipoDocumen: number;

  @Column({ name: 'DESCRIPCION_TIPO', type: 'varchar2', length: 100, nullable: true })
  descripcionTipo: string;

  @Column({ name: 'CANTIDAD_ACCIONES', type: 'number', nullable: true, default: 0 })
  cantidadAcciones: number;
}
